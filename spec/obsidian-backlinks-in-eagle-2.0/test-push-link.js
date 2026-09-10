#!/usr/bin/env node

/**
 * Test Connection & Push Link CLI Script for Eagle Extra Links
 * 
 * Usage:
 *   node test-push-link.js [options]
 * 
 * Examples:
 *   node test-push-link.js --title "Obsidian Note" --url "obsidian://open?vault=Main&file=Note"
 *   node test-push-link.js --id MTSPUNN17LBUG --title "Figma Spec" --url "https://figma.com/file/123"
 *   node test-push-link.js --standalone --title "Test Link" --url "https://example.com"
 *   node test-push-link.js --port 41598
 */

const http = require('http');
const readline = require('readline');
const path = require('path');
const fs = require('fs');

// Terminal colors
const c = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    red: '\x1b[31m',
    bgBlue: '\x1b[44m'
};

// Parse command line arguments
function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        host: '127.0.0.1',
        port: 41598,
        id: null,
        title: null,
        url: null,
        allowDuplicates: false,
        standalone: false,
        help: false,
        json: false
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--help' || arg === '-h') {
            options.help = true;
        } else if (arg === '--id' || arg === '-i') {
            options.id = args[++i];
        } else if (arg === '--title' || arg === '-t') {
            options.title = args[++i];
        } else if (arg === '--url' || arg === '-u') {
            options.url = args[++i];
        } else if (arg === '--port' || arg === '-p') {
            options.port = parseInt(args[++i], 10);
        } else if (arg === '--host' || arg === '-H') {
            options.host = args[++i];
        } else if (arg === '--allow-duplicates' || arg === '-d') {
            options.allowDuplicates = true;
        } else if (arg === '--standalone' || arg === '-s') {
            options.standalone = true;
        } else if (arg === '--json') {
            options.json = true;
        } else if (!arg.startsWith('-') && !options.id) {
            // Positional item ID
            options.id = arg;
        }
    }

    return options;
}

function printHelp() {
    console.log(`
${c.bold}${c.cyan}Eagle Extra Links — Test Connection & Push Link CLI${c.reset}

${c.bold}USAGE:${c.reset}
  node test-push-link.js [options]

${c.bold}OPTIONS:${c.reset}
  -i, --id <itemId>            Eagle item ID (auto-detected from Eagle if omitted)
  -t, --title <title>          Link title (e.g. "Project Specs")
  -u, --url <url>              Link URL / URI (e.g. "https://..." or "obsidian://...")
  -p, --port <port>            Extra Links IPC port (default: 41598)
  -H, --host <host>            Extra Links IPC host (default: 127.0.0.1)
  -d, --allow-duplicates       Explicitly permit duplicate links
  -s, --standalone             Start a standalone in-process server for immediate testing
      --json                   Output raw JSON response
  -h, --help                   Show this help message

${c.bold}EXAMPLES:${c.reset}
  ${c.dim}# Interactive prompt with smart auto-detection:${c.reset}
  node test-push-link.js

  ${c.dim}# Push link with title and URL to auto-detected item:${c.reset}
  node test-push-link.js --title "Obsidian Note" --url "obsidian://adv-uri?vault=Main&uid=123"

  ${c.dim}# Push link with specific item ID and port:${c.reset}
  node test-push-link.js --id MTSPUNN17LBUG --title "Figma Mockup" --url "https://figma.com/file/xyz" --port 41598

  ${c.dim}# Test in standalone mode without Eagle plugin active:${c.reset}
  node test-push-link.js --standalone --title "Test Documentation" --url "https://eagle.cool"
`);
}

// HTTP request helper
function httpRequest(options, postData = null) {
    return new Promise((resolve, reject) => {
        const reqOptions = {
            ...options,
            agent: false,
            headers: {
                'Connection': 'close',
                ...(options.headers || {})
            }
        };
        const req = http.request(reqOptions, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                let json = null;
                try {
                    json = JSON.parse(data);
                } catch (e) {
                    json = null;
                }
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: data,
                    json
                });
            });
        });

        req.on('error', err => reject(err));
        req.setTimeout(4000, () => {
            req.destroy();
            reject(new Error('Connection timed out'));
        });

        if (postData) {
            req.write(postData);
        }
        req.end();
    });
}

// Prompt user for input
function prompt(questionText, defaultValue = '') {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const displayPrompt = defaultValue 
        ? `${questionText} ${c.dim}(default: "${defaultValue}")${c.reset}: `
        : `${questionText}: `;

    return new Promise(resolve => {
        rl.question(displayPrompt, (answer) => {
            rl.close();
            const trimmed = answer.trim();
            resolve(trimmed || defaultValue);
        });
    });
}

// Auto-detect items from Eagle core API (port 41595)
async function detectEagleItem() {
    try {
        const res = await httpRequest({
            hostname: '127.0.0.1',
            port: 41595,
            path: '/api/item/list?limit=5',
            method: 'GET'
        });

        if (res.statusCode === 200 && res.json && res.json.data && res.json.data.length > 0) {
            return res.json.data[0];
        }
    } catch (e) {
        // Eagle core API not running or unreachable
    }
    return null;
}

// Query Eagle library info (port 41595)
async function detectEagleLibrary() {
    try {
        const res = await httpRequest({
            hostname: '127.0.0.1',
            port: 41595,
            path: '/api/library/info',
            method: 'GET'
        });

        if (res.statusCode === 200 && res.json && res.json.data && res.json.data.library) {
            return res.json.data.library.path;
        }
    } catch (e) {
        // ignore
    }
    return null;
}

// Probe IPC Server health
async function checkServerHealth(host, port) {
    try {
        const res = await httpRequest({
            hostname: host,
            port: port,
            path: '/health',
            method: 'GET'
        });

        if (res.statusCode === 200 && res.json) {
            // Check if this is Extra Links or something else (e.g. mcp-server)
            const isMcpServer = res.json.mode === 'stateless' || res.json.activeSseSessions !== undefined;
            const isExtraLinks = res.json.library !== undefined || res.json.version !== undefined;

            return {
                reachable: true,
                isExtraLinks: isExtraLinks && !isMcpServer,
                isMcpServer,
                details: res.json
            };
        }
        return { reachable: false, isExtraLinks: false, details: res.body };
    } catch (e) {
        return { reachable: false, isExtraLinks: false, error: e.message };
    }
}

// Scan common alternate ports
async function findActivePort(host, preferredPort) {
    const candidatePorts = [preferredPort, 41598, 41599, 41600, 41605];
    const checked = new Set();

    for (const port of candidatePorts) {
        if (checked.has(port)) continue;
        checked.add(port);

        const health = await checkServerHealth(host, port);
        if (health.reachable && health.isExtraLinks) {
            return { port, health };
        }
    }
    return null;
}

async function main() {
    const opts = parseArgs();

    if (opts.help) {
        printHelp();
        process.exit(0);
    }

    console.log(`\n${c.bold}${c.cyan}======================================================${c.reset}`);
    console.log(`${c.bold}${c.cyan}  🔗 Eagle Extra Links — Test Connection & Push Link  ${c.reset}`);
    console.log(`${c.bold}${c.cyan}======================================================${c.reset}\n`);

    let activeHost = opts.host;
    let activePort = opts.port;
    let standaloneServer = null;

    // Step 1: Resolve Standalone vs Live Server
    if (opts.standalone) {
        console.log(`${c.blue}ℹ Starting standalone in-process Extra Links IPC server...${c.reset}`);
        const IpcServer = require('./js/ipc-server.js');
        const ConfigManager = require('./js/config.js');

        // Detect library path from Eagle API or fallback
        const libraryPath = await detectEagleLibrary() || 'I:\\My Drive\\Eagle\\Main.library';
        global.eagle = { library: { path: libraryPath } };

        activePort = 41605;
        ConfigManager.saveConfig({
            serverEnabled: true,
            host: activeHost,
            port: activePort,
            accessRestrictionEnabled: false
        });

        const started = await IpcServer.start();
        if (!started) {
            console.error(`${c.red}✖ Failed to start standalone IPC server on port ${activePort}.${c.reset}`);
            process.exit(1);
        }
        standaloneServer = IpcServer;
        console.log(`${c.green}✔ Standalone IPC server running on http://${activeHost}:${activePort}${c.reset}`);
        console.log(`  ${c.dim}Target Library: ${libraryPath}${c.reset}\n`);
    } else {
        // Check connectivity to specified port
        process.stdout.write(`1. Connecting to Extra Links IPC on http://${activeHost}:${activePort}... `);
        const health = await checkServerHealth(activeHost, activePort);

        if (health.reachable && health.isExtraLinks) {
            console.log(`${c.green}${c.bold}CONNECTED ✔${c.reset}`);
            console.log(`   ${c.dim}Version:${c.reset} ${health.details.version || '1.2.0'} | ${c.dim}Library:${c.reset} ${health.details.library || '(active item)'}`);
        } else if (health.reachable && health.isMcpServer) {
            console.log(`${c.yellow}${c.bold}CONFLICT ⚠️${c.reset}`);
            console.log(`   ${c.yellow}Port ${activePort} is occupied by Eagle's 'mcp-server' plugin, not Extra Links.${c.reset}`);
            process.stdout.write(`   Scanning for Extra Links on alternate ports... `);

            const altFound = await findActivePort(activeHost, activePort);
            if (altFound) {
                activePort = altFound.port;
                console.log(`${c.green}FOUND on port ${activePort} ✔${c.reset}`);
            } else {
                console.log(`${c.red}Not found.${c.reset}`);
                console.log(`\n${c.bold}Options to resolve:${c.reset}`);
                console.log(`  1. In Eagle, click the ${c.bold}⚙️ Settings${c.reset} icon in the Extra Links header and change the port to ${c.bold}41598${c.reset}.`);
                console.log(`  2. Or run this script with ${c.cyan}--standalone${c.reset} to test immediately without the Eagle UI:`);
                console.log(`     ${c.bold}node test-push-link.js --standalone${c.reset}\n`);
                process.exit(1);
            }
        } else {
            console.log(`${c.red}${c.bold}UNREACHABLE ✖${c.reset}`);
            console.log(`   ${c.dim}Could not connect to http://${activeHost}:${activePort} (${health.error || 'Connection refused'}).${c.reset}`);
            
            process.stdout.write(`   Scanning for Extra Links on alternate ports... `);
            const altFound = await findActivePort(activeHost, activePort);
            if (altFound) {
                activePort = altFound.port;
                console.log(`${c.green}FOUND on port ${activePort} ✔${c.reset}`);
            } else {
                console.log(`${c.red}Not found.${c.reset}`);
                console.log(`\n${c.yellow}⚠️  The Extra Links IPC server is not running on port ${activePort}.${c.reset}`);
                console.log(`\n${c.bold}Quick test options:${c.reset}`);
                console.log(`  - If Eagle is running with Extra Links, check the port in ${c.bold}⚙️ Settings${c.reset} and specify ${c.cyan}--port <port>${c.reset}.`);
                console.log(`  - To test connection and pushing a link right now via standalone mode, run:`);
                console.log(`    ${c.bold}${c.green}node test-push-link.js --standalone${c.reset}\n`);
                process.exit(1);
            }
        }
        console.log('');
    }

    // Step 2: Resolve Target Item ID
    let itemId = opts.id;
    let itemName = '';

    if (!itemId) {
        process.stdout.write(`2. Discovering active item from Eagle... `);
        const detectedItem = await detectEagleItem();
        if (detectedItem) {
            itemId = detectedItem.id;
            itemName = detectedItem.name || '';
            console.log(`${c.green}FOUND ✔${c.reset}`);
            console.log(`   ${c.bold}Target Item:${c.reset} "${itemName}" (${c.cyan}${itemId}${c.reset})\n`);
        } else {
            console.log(`${c.dim}None detected via Eagle API.${c.reset}`);
            if (process.stdin.isTTY) {
                itemId = await prompt('Enter target Eagle Item ID', 'MTSPUNN17LBUG');
            } else {
                itemId = 'MTSPUNN17LBUG';
            }
            console.log(`   ${c.bold}Using Item ID:${c.reset} ${c.cyan}${itemId}${c.reset}\n`);
        }
    } else {
        console.log(`2. Target Item ID: ${c.cyan}${itemId}${c.reset}\n`);
    }

    // Step 3: Resolve Link Title & URL
    let linkTitle = opts.title;
    let linkUrl = opts.url;

    if (linkTitle === null || linkUrl === null) {
        if (process.stdin.isTTY) {
            console.log(`3. Configure Link Details:`);
            if (linkTitle === null) {
                linkTitle = await prompt('   Enter Link Title', 'Project Research & Docs');
            }
            if (linkUrl === null) {
                linkUrl = await prompt('   Enter Link URL', 'https://eagle.cool/blog');
            }
            console.log('');
        } else {
            linkTitle = linkTitle !== null ? linkTitle : 'Test Reference';
            linkUrl = linkUrl !== null ? linkUrl : 'https://eagle.cool';
        }
    }

    console.log(`3. Link to Push:`);
    console.log(`   ${c.bold}Title:${c.reset} ${c.magenta}"${linkTitle}"${c.reset}`);
    console.log(`   ${c.bold}URL:${c.reset}   ${c.blue}${linkUrl}${c.reset}`);
    console.log(`   ${c.bold}Allow Duplicates:${c.reset} ${opts.allowDuplicates ? c.yellow + 'true' : c.dim + 'false (idempotent)'}${c.reset}\n`);

    // Step 4: Push Link via POST /api/item/:id/links
    process.stdout.write(`4. Pushing link to http://${activeHost}:${activePort}/api/item/${itemId}/links... `);
    
    const postPayload = JSON.stringify({
        title: linkTitle,
        url: linkUrl,
        allowDuplicates: opts.allowDuplicates
    });

    const postRes = await httpRequest({
        hostname: activeHost,
        port: activePort,
        path: `/api/item/${encodeURIComponent(itemId)}/links`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postPayload)
        }
    }, postPayload);

    if (postRes.statusCode !== 200) {
        console.log(`${c.red}${c.bold}FAILED (${postRes.statusCode}) ✖${c.reset}`);
        console.error(`   ${c.red}${postRes.body}${c.reset}\n`);
        if (standaloneServer) await standaloneServer.stop();
        process.exit(1);
    }

    console.log(`${c.green}${c.bold}SUCCESS (200 OK) ✔${c.reset}\n`);

    const resJson = postRes.json;
    if (opts.json) {
        console.log(JSON.stringify(resJson, null, 2));
    } else {
        if (resJson.alreadyExists) {
            console.log(`   ${c.yellow}ℹ Link already existed.${c.reset} Idempotent deduplication applied (addedCount: 0).`);
            if (linkTitle) {
                console.log(`   ${c.dim}If the previous entry had a blank title, it has now been enriched with "${linkTitle}".${c.reset}`);
            }
        } else {
            console.log(`   ${c.green}✔ New link appended successfully!${c.reset} (addedCount: ${resJson.addedCount})`);
        }

        // Display formatted links table
        console.log(`\n${c.bold}📋 Current Stored Links for Item ${c.cyan}${itemId}${c.reset}${c.bold}:${c.reset}`);
        console.log(`${c.dim}--------------------------------------------------------------------------------${c.reset}`);
        console.log(`${c.bold} #  | ${c.bold}Display Mode | ${c.bold}Title${' '.repeat(25)} | ${c.bold}Target URL${c.reset}`);
        console.log(`${c.dim}--------------------------------------------------------------------------------${c.reset}`);

        const links = resJson.links || [];
        links.forEach((l, idx) => {
            const hasTitle = l.title && l.title.trim().length > 0;
            const mode = hasTitle ? `${c.green}[T]${c.reset}` : `${c.blue}[U]${c.reset}`;
            const titleDisplay = (l.title || `${c.dim}(empty)${c.reset}`).padEnd(30).slice(0, 30);
            const urlDisplay = l.url || `${c.dim}(empty)${c.reset}`;
            console.log(` ${String(idx).padEnd(2)} |     ${mode}      | ${titleDisplay} | ${urlDisplay}`);
        });
        console.log(`${c.dim}--------------------------------------------------------------------------------${c.reset}`);
        console.log(`Total: ${links.length} link(s)\n`);
    }

    // Step 5: Follow-up Verification with GET
    process.stdout.write(`5. Verifying persistence via GET /api/item/${itemId}/links... `);
    const getRes = await httpRequest({
        hostname: activeHost,
        port: activePort,
        path: `/api/item/${encodeURIComponent(itemId)}/links`,
        method: 'GET'
    });

    if (getRes.statusCode === 200 && getRes.json) {
        const verified = (getRes.json.links || []).some(l => l.url === linkUrl);
        if (verified) {
            console.log(`${c.green}${c.bold}VERIFIED ON DISK ✔${c.reset}`);
        } else {
            console.log(`${c.yellow}Link not found in response${c.reset}`);
        }
    } else {
        console.log(`${c.yellow}Warning: Verification GET returned status ${getRes.statusCode}${c.reset}`);
    }

    if (standaloneServer) {
        await standaloneServer.stop();
        console.log(`\n${c.dim}Standalone server shut down cleanly.${c.reset}`);
    }

    console.log(`\n${c.bold}${c.green}🎉 Done! The link is ready and live in Eagle.${c.reset}\n`);
    process.exit(0);
}

main().catch(err => {
    console.error(`\n${c.red}Unexpected error:${c.reset}`, err);
    process.exit(1);
});
