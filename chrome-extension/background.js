// 创建右键菜单
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: 'add-to-nav',
        title: '添加到导航仪表盘',
        contexts: ['page', 'link']
    });
});

// 右键菜单点击处理
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'add-to-nav') {
        // 获取要添加的URL和标题
        let url, title;

        if (info.linkUrl) {
            // 如果是右键点击链接
            url = info.linkUrl;
            title = info.linkText || new URL(info.linkUrl).hostname;
        } else {
            // 如果是右键点击页面
            url = tab.url;
            title = tab.title;
        }

        // 将数据存储到临时存储，供popup读取
        chrome.storage.local.set({
            pendingSite: {
                url: url,
                title: title,
                favIconUrl: tab.favIconUrl || '',
                timestamp: Date.now()
            }
        }, async () => {
            // 获取当前显示器信息，将窗口定位到右侧
            const displays = await chrome.system.display.getInfo();
            const primaryDisplay = displays.find(d => d.isPrimary) || displays[0];
            const screenWidth = primaryDisplay?.workArea?.width || 1920;
            const screenHeight = primaryDisplay?.workArea?.height || 1080;

            const popupWidth = 420;
            const popupHeight = 520;
            const left = screenWidth - popupWidth - 20; // 距右边缘 20px
            const top = Math.round((screenHeight - popupHeight) / 2); // 垂直居中

            // 打开popup（通过创建新窗口的方式）
            chrome.windows.create({
                url: chrome.runtime.getURL('popup.html?mode=contextMenu'),
                type: 'popup',
                width: popupWidth,
                height: popupHeight,
                left: left,
                top: top,
                focused: true
            });
        });
    }
});

// 监听来自popup的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getCurrentTab') {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                sendResponse({
                    url: tabs[0].url,
                    title: tabs[0].title,
                    favIconUrl: tabs[0].favIconUrl || ''
                });
            } else {
                sendResponse(null);
            }
        });
        return true; // 保持消息通道开放
    }
});
