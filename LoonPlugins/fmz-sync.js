const axios = require('axios');
const fs = require('fs');
const path = require('path');

// === 配置区 ===

// App 别名/关键词映射表（用于 FmzBlockAds 过滤任务）
const APP_MAP = {
    "闲鱼": ["闲鱼", "goofish", "xmyu"],
    "淘宝": ["淘宝", "taobao"],
    "网易云音乐": ["网易云音乐", "music.163", "music.126", "whyiyyybyt"],
    "夸克": ["夸克", "quark", "kxke", "uc.cn"],
    "Reddit": ["reddit"],
    "酷安": ["酷安", "kuan", "coolapk"],
    "脉脉": ["脉脉", "mdmd", "maimai", "taou"],
    "解除微信链接限制": ["解除微信链接限制", "lmjpxmvi", "微信解除链接限制"],
    "快递100": ["快递100", "kuaidi100"],
    "字节跳动广告": ["字节跳动广告", "bytedance", "toutiao", "pangle", "zijieapi"],
    "阿里巴巴": ["阿里巴巴", "albb", "alibaba"],
    "阿里云盘": ["阿里云盘", "alyp"],
    "百度网盘": ["百度网盘", "bdwp"],
    "币安": ["币安", "binance"],
    "哔哩哔哩": ["哔哩哔哩", "bilibili"],
    "钉钉": ["钉钉", "dingtalk"],
    "华住会": ["华住会", "hzh"],
    "和风天气": ["和风天气", "qweather"],
    "ONE": ["ONE", "one"],
    "平安好车主": ["平安好车主", "pjhcz"],
    "拼多多": ["拼多多", "pdd"],
    "腾讯广告": ["腾讯广告", "tencentads"],
    "米家": ["米家", "mijia"],
    "雪球": ["雪球", "xueqiu"],
    "小宇宙": ["小宇宙", "xyz"],
    "一淘": ["一淘", "etao"],
    "招商银行": ["招商银行", "cmb"],
    "掌上生活": ["掌上生活", "cmbchina"],
    "中国移动": ["中国移动", "chinamobile"],
    "12306": ["12306"]
};

// 任务配置列表
const TASKS = [
    {
        name: "FmzBlockAds",
        type: "filter", // 旧模式：过滤保留特定 App
        source: "https://github.com/fmz200/wool_scripts/raw/main/Loon/plugin/blockAds.plugin",
        output: "my_block_ads.lpx",
        keepApps: [
            "夸克", "酷安", "脉脉", "Reddit", "淘宝", "网易云音乐",
            "解除微信链接限制", "闲鱼", "快递100", "字节跳动广告",
            "阿里巴巴", "阿里云盘", "百度网盘", "哔哩哔哩", "钉钉", "华住会",
            "和风天气", "ONE", "平安好车主", "拼多多", "腾讯广告", "米家",
            "雪球", "小宇宙", "一淘", "招商银行", "掌上生活", "中国移动", "12306"
        ]
    },
    {
        name: "WeChatAds",
        type: "merge", // 新模式：合并多个源
        sources: [
            "https://raw.githubusercontent.com/mihoyo-typ/KeleeOne/Loon/Plugin/Weixin_Official_Accounts_remove_ads.lpx",
            "https://raw.githubusercontent.com/mihoyo-typ/KeleeOne/Loon/Plugin/WexinMiniPrograms_Remove_ads.lpx"
        ],
        output: "WeChat_Ads_Merge.lpx",
        header: {
            name: "WeChat Ads Removal",
            desc: "Merged plugin for WeChat Official Accounts & Mini Programs (同步自可莉)",
            author: "Hpxo",
            icon: "https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/WeChat.png"
        }
    }
];

// =================

// 获取当前北京时间
function getNowDate() {
    const now = new Date();
    const tzOffset = 8; // 北京时间 UTC+8
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const nd = new Date(utc + (3600000 * tzOffset));

    const y = nd.getFullYear();
    const m = String(nd.getMonth() + 1).padStart(2, '0');
    const d = String(nd.getDate()).padStart(2, '0');
    const h = String(nd.getHours()).padStart(2, '0');
    const min = String(nd.getMinutes()).padStart(2, '0');
    const s = String(nd.getSeconds()).padStart(2, '0');

    return `${y}-${m}-${d} ${h}:${min}:${s}`;
}

// 统一网络请求
async function downloadContent(url) {
    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/plain,text/html,application/xhtml+xml,*/*'
            },
            timeout: 10000
        });
        return response.data;
    } catch (err) {
        console.error(`下载失败: ${url}`);
        throw err;
    }
}

// 辅助函数：判断行内容是否匹配指定的 App 及其别名 (仅用于 filter 模式)
function checkAppMatch(trimmedLine, appName) {
    const keywords = APP_MAP[appName] || [appName];
    const lowerLine = trimmedLine.toLowerCase();
    return keywords.some(k => {
        const lowerK = k.toLowerCase();
        if (lowerK === 'whyiy' && lowerLine.includes('dict')) return false;
        if (appName === "解除微信链接限制" && lowerLine.includes("微信解除链接限制")) return true;

        // 排除哔哩哔哩漫画
        if ((lowerK === '哔哩哔哩' || lowerK === 'bilibili') &&
            (lowerLine.includes('漫画') || lowerLine.includes('manga') || lowerLine.includes('manhua'))) {
            return false;
        }
        return lowerLine.includes(lowerK);
    });
}

// --- 处理 Filter 任务 (复用旧逻辑) ---
async function processFilterTask(task) {
    console.log(`\n>>> 开始执行 Filter 任务: ${task.name}`);
    const outputFile = path.join(__dirname, task.output);
    const content = await downloadContent(task.source);

    // 获取本地已有 Headers
    let localHeaders = {};
    if (fs.existsSync(outputFile)) {
        const existingLines = fs.readFileSync(outputFile, 'utf-8').split('\n');
        for (const line of existingLines) {
            if (line.startsWith('#!')) {
                const parts = line.trim().split('=');
                if (parts.length >= 2) {
                    const key = parts[0].replace('#!', '');
                    const value = parts.slice(1).join('=');
                    if (key !== 'date') localHeaders[key] = value;
                }
            } else if (line.trim().startsWith('[') || (line.trim() !== "" && !line.trim().startsWith('#'))) {
                break;
            }
        }
    }

    const lines = content.split('\n');
    let result = [];
    let skipCurrentBlock = false;
    let inSection = "";
    let lastAppHeader = "";
    let pendingHeader = "";
    const syncDate = getNowDate();

    const pushLine = (l) => {
        const isCurrentEmpty = l.trim() === "";
        const isLastEmpty = result.length > 0 && result[result.length - 1].trim() === "";
        if (isCurrentEmpty) {
            if (result.length > 0 && !isLastEmpty) result.push("");
        } else {
            if (pendingHeader && pendingHeader !== lastAppHeader) {
                if (result.length > 0 && !isLastEmpty) result.push("");
                const sectionName = inSection.toLowerCase();
                if (sectionName === '[argument]' || sectionName === '[script]') {
                    result.push(`# 🧲 ${pendingHeader} 🧲`);
                } else if (sectionName === '[rule]') {
                    result.push(`# 🚫 ${pendingHeader}`);
                } else if (sectionName === '[rewrite]') {
                    result.push(`# ✍🏻 ${pendingHeader}`);
                } else {
                    result.push(`# === ${pendingHeader} ===`);
                }
                lastAppHeader = pendingHeader;
                pendingHeader = "";
            }
            result.push(l);
        }
    };

    let hasWrittenExplanation = false;

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        const trimmed = line.trim();

        // Header 处理
        if (trimmed.startsWith('#!')) {
            const key = trimmed.split('=')[0].replace('#!', '');
            if (key === 'date') line = `#!date=${syncDate}`;
            else if (localHeaders[key]) line = `#!${key}=${localHeaders[key]}`;
            result.push(line);
            continue;
        } else if (!hasWrittenExplanation && result.length > 0 && !trimmed.startsWith('#!')) {
            result.push('# [Rule]和[Rewrite]始终生效，开关仅控制[Script]（复杂净化）部分');
            hasWrittenExplanation = true;
        }

        // Section 处理
        if (trimmed.startsWith('[')) {
            inSection = trimmed;
            const sectionName = trimmed.toLowerCase();
            if (sectionName !== '[mitm]' && sectionName !== '[hostname]') pushLine(line);
            skipCurrentBlock = (sectionName === '[argument]');
            lastAppHeader = "";
            pendingHeader = "";
            continue;
        }

        if (inSection.toLowerCase() === '[mitm]' || inSection.toLowerCase() === '[hostname]') continue;

        const matchedApp = task.keepApps.find(app => checkAppMatch(trimmed, app));
        const isArgument = inSection.toLowerCase() === '[argument]';

        if (trimmed.startsWith('#')) {
            const isHeader = trimmed.includes('>') || task.keepApps.some(app => trimmed === `# ${app}` || trimmed === `# > ${app}`);
            if (isHeader) {
                const commentContent = trimmed.includes('>') ? trimmed.split('>')[1].trim() : trimmed.replace('#', '').trim();
                const titleMatch = task.keepApps.find(app => checkAppMatch(commentContent, app));
                if (titleMatch) {
                    skipCurrentBlock = false;
                    pendingHeader = titleMatch;
                } else {
                    skipCurrentBlock = true;
                    pendingHeader = "";
                }
                continue;
            }

            const IMPORTANT_COMMENT_KEYWORDS = ["hostname", "感谢", "感謝", "分享", "注意", "配置"];
            const isImportant = IMPORTANT_COMMENT_KEYWORDS.some(k => trimmed.toLowerCase().includes(k));
            const isRuleLike = /^#\s*http-/.test(trimmed) || trimmed.includes('script-path=') || trimmed.includes('REJECT');

            if ((isImportant || isRuleLike || !matchedApp) && !skipCurrentBlock) {
                pushLine(line);
                continue;
            }
        } else if (trimmed !== "") {
            if (isArgument && matchedApp) pendingHeader = matchedApp;
        }

        if (trimmed === "") {
            pushLine("");
            if (isArgument) skipCurrentBlock = true;
        } else {
            let shouldKeep = !!matchedApp; // Argument 默认仅保留匹配 App
            if (!isArgument) shouldKeep = !skipCurrentBlock;

            if (shouldKeep) {
                const finalLine = line.replace(/脚本开关/g, 'Script开关');
                if (trimmed.startsWith('#') && matchedApp) {
                    const isRuleLike = /^#\s*http-/.test(trimmed) || trimmed.includes('script-path=') || trimmed.includes('REJECT');
                    if (!isRuleLike) continue;
                }
                pushLine(finalLine);
            }
        }
    }

    // Hostname 提取
    const uniqueHostnames = new Set();
    result.forEach(l => {
        const t = l.trim();
        if (t.startsWith('#') && t.includes('hostname')) {
            const hPart = t.split('=')[1] || "";
            hPart.split(',').forEach(h => {
                const cleanH = h.trim();
                if (cleanH && !/[\u4e00-\u9fa5\s]/.test(cleanH) && cleanH.includes('.')) uniqueHostnames.add(cleanH);
            });
        }
        if (!t.startsWith('#') && (t.startsWith('DOMAIN') || t.startsWith('IP-CIDR'))) {
            const parts = t.split(',');
            if (parts.length > 1 && (parts[0] === 'DOMAIN' || parts[0] === 'DOMAIN-SUFFIX')) uniqueHostnames.add(parts[1].trim());
        }
    });

    if (uniqueHostnames.size > 0) {
        result.push("", "[MITM]", `hostname = ${Array.from(uniqueHostnames).join(', ')}`);
    }

    fs.writeFileSync(outputFile, result.join('\n').trim() + '\n');
    console.log(`✅ 任务 ${task.name} 完成，已保存至 ${outputFile}`);
}

// --- 处理 Merge 任务 ---
async function processMergeTask(task) {
    console.log(`\n>>> 开始执行 Merge 任务: ${task.name}`);
    const outputFile = path.join(__dirname, task.output);

    // 数据容器
    const mergedData = {
        rule: new Set(),
        rewrite: new Set(),
        script: new Set(),
        mitm: new Set(),
        general: []
    };

    // 下载并解析所有源
    for (const sourceUrl of task.sources) {
        console.log(`正在下载: ${sourceUrl}`);
        const content = await downloadContent(sourceUrl);
        const lines = content.split('\n');

        let currentSection = null;
        for (let line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue; // 暂时忽略注释，通过 Header 统一添加说明

            if (trimmed.startsWith('[')) {
                const sectionName = trimmed.toLowerCase();
                if (sectionName.includes('rule')) currentSection = 'rule';
                else if (sectionName.includes('rewrite')) currentSection = 'rewrite';
                else if (sectionName.includes('script')) currentSection = 'script';
                else if (sectionName.includes('mitm')) currentSection = 'mitm';
                else currentSection = null; // 忽略其他未知段落
                continue;
            }

            if (currentSection === 'rule') mergedData.rule.add(trimmed);
            else if (currentSection === 'rewrite') mergedData.rewrite.add(trimmed);
            else if (currentSection === 'script') mergedData.script.add(trimmed);
            else if (currentSection === 'mitm') {
                if (trimmed.startsWith('hostname')) {
                    const hosts = trimmed.split('=')[1] || "";
                    hosts.split(',').forEach(h => mergedData.mitm.add(h.trim()));
                }
            }
        }
    }

    // 构建文件内容
    const result = [];

    // 1. Header
    if (task.header) {
        if (task.header.name) result.push(`#!name=${task.header.name}`);
        if (task.header.desc) result.push(`#!desc=${task.header.desc}`);
        if (task.header.author) result.push(`#!author=${task.header.author}`);
        if (task.header.icon) result.push(`#!icon=${task.header.icon}`);
        result.push(`#!date=${getNowDate()}`);
        result.push("");
    }

    // 2. Rules
    if (mergedData.rule.size > 0) {
        result.push("[Rule]");
        mergedData.rule.forEach(r => result.push(r));
        result.push("");
    }

    // 3. Rewrites
    if (mergedData.rewrite.size > 0) {
        result.push("[Rewrite]");
        mergedData.rewrite.forEach(r => result.push(r));
        result.push("");
    }

    // 4. Scripts
    if (mergedData.script.size > 0) {
        result.push("[Script]");
        mergedData.script.forEach(s => result.push(s));
        result.push("");
    }

    // 5. MITM
    if (mergedData.mitm.size > 0) {
        result.push("[MITM]");
        // 过滤掉空值
        const validHosts = Array.from(mergedData.mitm).filter(h => h && h.length > 0);
        if (validHosts.length > 0) {
            result.push(`hostname = ${validHosts.join(', ')}`);
        }
        result.push("");
    }

    fs.writeFileSync(outputFile, result.join('\n').trim() + '\n');
    console.log(`✅ 任务 ${task.name} 完成，已保存至 ${outputFile}`);
}

// === 主入口 ===
async function run() {
    console.log('--- 开始批量同步任务 ---');
    console.log(`当前时间: ${getNowDate()}`);

    for (const task of TASKS) {
        try {
            if (task.type === 'filter') {
                await processFilterTask(task);
            } else if (task.type === 'merge') {
                await processMergeTask(task);
            }
        } catch (err) {
            console.error(`❌ 任务 ${task.name} 失败:`, err.message);
        }
    }
    console.log('\n--- 所有任务已完成 ---');
}

run().catch(err => {
    console.error('全局错误:', err);
    process.exit(1);
});
