const axios = require('axios');
const fs = require('fs');
const path = require('path');

// === 配置区 ===
const SOURCE_URL = 'https://github.com/fmz200/wool_scripts/raw/main/Loon/plugin/blockAds.plugin';
const OUTPUT_FILE = path.join(__dirname, 'my_block_ads.lpx');

// 您真正关心的 App 列表
const KEEP_APPS = [
    "夸克", "酷安", "脉脉", "Reddit", "淘宝", "网易云音乐",
    "解除微信链接限制", "闲鱼", "Youtube", "快递100", "字节跳动广告",
    "阿里巴巴", "阿里云盘", "百度网盘", "哔哩哔哩", "钉钉", "华住会",
    "和风天气", "ONE", "平安好车主", "拼多多", "腾讯广告", "米家",
    "雪球", "小宇宙", "一淘", "招商银行", "掌上生活", "中国移动", "12306"
];

// App 别名/关键词映射表（确保不同段落的规则都能被搜到）
const APP_MAP = {
    "闲鱼": ["闲鱼", "goofish", "xmyu"],
    "淘宝": ["淘宝", "taobao"],
    "网易云音乐": ["网易云音乐", "music.163", "music.126", "whyiyyybyt"],
    "Youtube": ["youtube", "googlevideo"],
    "夸克": ["夸克", "quark", "kxke", "uc.cn"],
    "Reddit": ["reddit"],
    "酷安": ["酷安", "kuan", "coolapk"],
    "脉脉": ["脉脉", "mdmd", "maimai", "taou"],
    "解除微信链接限制": ["解除微信链接限制", "lmjpxmvi", "微信解除链接限制"], // 增加“微信解除链接限制”以匹配 # > 微信解除链接限制
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

// 必须保留的通用功能/全局配置关键词 (仅用于辅助识别，不再作为强制保留依据)
const GENERIC_KEYWORDS = [
    "脚本开关", "Script开关"
];
// =================

// 获取本地已有的 Headers，实现自定义信息的自动保留
function getLocalHeaders() {
    if (!fs.existsSync(OUTPUT_FILE)) return {};
    const content = fs.readFileSync(OUTPUT_FILE, 'utf-8');
    const lines = content.split('\n');
    const headers = {};
    for (const line of lines) {
        if (line.startsWith('#!')) {
            const parts = line.trim().split('=');
            if (parts.length >= 2) {
                const key = parts[0].replace('#!', '');
                const value = parts.slice(1).join('=');
                if (key !== 'date') { // date 字段依然需要实时更新
                    headers[key] = value;
                }
            }
        } else if (line.trim().startsWith('[') || line.trim() !== "" && !line.trim().startsWith('#')) {
            // 碰到非注释或非头部行，停止读取
            break;
        }
    }
    return headers;
}

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

// 辅助函数：判断行内容是否匹配指定的 App 及其别名
function checkAppMatch(trimmedLine, appName) {
    const keywords = APP_MAP[appName] || [appName];
    const lowerLine = trimmedLine.toLowerCase();
    // 使用边界检查或更精确的内容判断，防止 whyiy 匹配 whyiyzdccidm
    return keywords.some(k => {
        const lowerK = k.toLowerCase();
        // 如果关键词是 whyiy，确保它不是作为有道词典的一部分（这只是个补丁，主要靠关键词精确化）
        if (lowerK === 'whyiy' && lowerLine.includes('dict')) return false;

        // 针对 "微信解除链接限制" 做更宽松的匹配以防万一
        if (appName === "解除微信链接限制" && lowerLine.includes("微信解除链接限制")) return true;

        return lowerLine.includes(lowerK);
    });
}

async function run() {
    console.log('--- 开始同步任务 ---');
    console.log(`目标 URL: ${SOURCE_URL}`);

    const localHeaders = getLocalHeaders();
    console.log('已读取本地自定义文件头:', Object.keys(localHeaders).join(', '));

    try {
        const response = await axios.get(SOURCE_URL);
        const content = response.data;
        const lines = content.split('\n');

        let result = [];
        let skipCurrentBlock = false;
        let inSection = "";
        let totalLines = lines.length;
        let preservedLines = 0;
        let lastAppHeader = ""; // 记录当前段落内已写入的 App 标题
        let pendingHeader = ""; // 等待写入的 App 标题
        const syncDate = getNowDate();

        console.log(`原插件总行数: ${totalLines}`);
        console.log(`保留 App: ${KEEP_APPS.join(', ')}`);
        console.log(`同步时间: ${syncDate}`);

        const pushLine = (l) => {
            const isCurrentEmpty = l.trim() === "";
            const isLastEmpty = result.length > 0 && result[result.length - 1].trim() === "";
            if (isCurrentEmpty) {
                if (result.length > 0 && !isLastEmpty) {
                    result.push("");
                    preservedLines++;
                }
            } else {
                // 如果有待处理的 App 标题，在推入实际内容前先写标题
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
                preservedLines++;
            }
        };

        let hasWrittenExplanation = false;

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            const trimmed = line.trim();

            // 1. Header 处理
            if (trimmed.startsWith('#!')) {
                const key = trimmed.split('=')[0].replace('#!', '');
                if (key === 'date') {
                    line = `#!date=${syncDate}`;
                } else if (localHeaders[key]) {
                    line = `#!${key}=${localHeaders[key]}`;
                }
                result.push(line);
                preservedLines++;
                continue;
            } else if (!hasWrittenExplanation && result.length > 0) {
                result.push('# [Rule]和[Rewrite]始终生效，开关仅控制[Script]（复杂净化）部分');
                preservedLines++;
                hasWrittenExplanation = true;
            }

            // 2. 段落标题处理
            if (trimmed.startsWith('[')) {
                inSection = trimmed;
                const sectionName = trimmed.toLowerCase();
                if (sectionName !== '[mitm]' && sectionName !== '[hostname]') {
                    pushLine(line);
                }
                skipCurrentBlock = (sectionName === '[argument]');
                lastAppHeader = "";
                pendingHeader = "";
                continue;
            }

            if (inSection.toLowerCase() === '[mitm]' || inSection.toLowerCase() === '[hostname]') continue;

            // 3. 核心块过滤与标注逻辑
            const matchedApp = KEEP_APPS.find(app => checkAppMatch(trimmed, app));

            // 重要：在 Argument 段落，不再无脑信任 GENERIC_KEYWORDS
            const isArgument = inSection.toLowerCase() === '[argument]';

            if (trimmed.startsWith('#')) {
                // 识别 App 边界块（标题行）
                // 情况 1: 包含 > 符号的标题 (如 # > 淘宝)
                // 情况 2: 纯文本标题但匹配 App 名称 (如 # 字节跳动广告)
                const isHeader = trimmed.includes('>') || KEEP_APPS.some(app => trimmed === `# ${app}` || trimmed === `# > ${app}`);

                if (isHeader) {
                    const commentContent = trimmed.includes('>') ? trimmed.split('>')[1].trim() : trimmed.replace('#', '').trim();
                    const titleMatch = KEEP_APPS.find(app => {
                        const keywords = APP_MAP[app] || [app];
                        const lowerTitle = commentContent.toLowerCase();
                        return keywords.some(k => lowerTitle.includes(k.toLowerCase()));
                    });

                    if (titleMatch) {
                        skipCurrentBlock = false;
                        pendingHeader = titleMatch;
                    } else {
                        skipCurrentBlock = true;
                        pendingHeader = "";
                    }
                    continue;
                }

                // 处理块内注释：保留重要元数据，被注释的规则，以及说明性文字
                const IMPORTANT_COMMENT_KEYWORDS = ["hostname", "感谢", "感謝", "分享", "注意", "配置"];
                const isImportant = IMPORTANT_COMMENT_KEYWORDS.some(k => trimmed.toLowerCase().includes(k));

                // 识别被注释的规则 (以 #http 开头或包含关键指令)
                const isRuleLike = /^#\s*http-/.test(trimmed) || trimmed.includes('script-path=') || trimmed.includes('REJECT');

                // 即使在跳过的块中，如果注释本身明确匹配 App，也要保留（可能是被误划入其他块的规则）
                // 修正：用户要求严格隔离，不再主动“捞”规则
                if ((isImportant || isRuleLike || !matchedApp) && !skipCurrentBlock) {
                    pushLine(line);
                    continue;
                }
            } else if (trimmed !== "") {
                // 非注释行：在 [Argument] 段落中，我们需要根据内容识别 App 以便生成标题
                if (isArgument && matchedApp) {
                    pendingHeader = matchedApp;
                }
                // 对于其他段落（[Rule], [Rewrite]），完全依赖标题注释确定的 skipCurrentBlock 状态
            }

            // 4. 执行保留逻辑
            if (trimmed === "") {
                pushLine("");
                if (isArgument) skipCurrentBlock = true;
            } else {
                // 最终决定是否保留该行
                let shouldKeep = false;
                if (isArgument) {
                    // Argument 段落：只有匹配到 App 或者是极个别的全局参数（如果有）才保留
                    shouldKeep = !!matchedApp;
                } else {
                    // 其他段落：遵循块跳过逻辑
                    shouldKeep = !skipCurrentBlock;
                }

                if (shouldKeep) {
                    const finalLine = line.replace(/脚本开关/g, 'Script开关');
                    // 只有当该行是普通的 App 名字注释（且没有被上方的 isImportant/isRuleLike 逻辑捕获）时才跳过
                    // 这通常是为了过滤掉原插件中多余的应用名标题
                    if (trimmed.startsWith('#') && matchedApp) {
                        // 二次确认：如果是规则类的注释，即便匹配了 App 也要保留
                        const isRuleLike = /^#\s*http-/.test(trimmed) || trimmed.includes('script-path=') || trimmed.includes('REJECT');
                        if (!isRuleLike) continue;
                    }
                    pushLine(finalLine);
                }
            }
        }

        // 5. 规则驱动的 Hostname 提取
        console.log('正在提取相关的 Hostname...');
        const uniqueHostnames = new Set();

        // 从已保留的行中提取 hostname
        result.forEach(l => {
            const t = l.trim();
            // 情况 1: 从 # hostname = ... 提取
            if (t.startsWith('#') && t.includes('hostname')) {
                const hPart = t.split('=')[1] || "";
                hPart.split(',').forEach(h => {
                    const cleanH = h.trim();
                    // 仅添加合法的域名（简单的正则判断：不含中文，不含空格，包含点）
                    if (cleanH && !/[\u4e00-\u9fa5\s]/.test(cleanH) && cleanH.includes('.')) {
                        uniqueHostnames.add(cleanH);
                    }
                });
            }
            // 情况 2: 从标准的 URL 规则中提取域名 (Rule $1, $2, $3...)
            // 简单处理：如果是域名规则行，提取第一个逗号后的部分
            if (!t.startsWith('#') && (t.startsWith('DOMAIN') || t.startsWith('IP-CIDR'))) {
                const parts = t.split(',');
                if (parts.length > 1 && (parts[0] === 'DOMAIN' || parts[0] === 'DOMAIN-SUFFIX')) {
                    uniqueHostnames.add(parts[1].trim());
                }
            }
        });

        if (uniqueHostnames.size > 0) {
            pushLine("");
            pushLine('[MITM]');
            pushLine(`hostname = ${Array.from(uniqueHostnames).join(', ')}`);
            console.log(`提取了 ${uniqueHostnames.size} 个 Hostname`);
        } else {
            console.log('未发现匹配的 Hostname');
        }

        fs.writeFileSync(OUTPUT_FILE, result.join('\n').trim() + '\n');
        console.log(`--- 同步完成！ ---`);
        console.log(`文件保存至: ${OUTPUT_FILE}`);
        console.log(`精简后行数: ${preservedLines} (压缩率: ${((1 - preservedLines / totalLines) * 100).toFixed(1)}%)`);

    } catch (err) {
        console.error('同步过程中发生错误:');
        if (err.response) {
            console.error(`HTTP 状态码: ${err.response.status}`);
        } else {
            console.error(err.message);
        }
        throw err;
    }
}

run().catch(err => {
    console.error('同步失败:', err);
    process.exit(1);
});
