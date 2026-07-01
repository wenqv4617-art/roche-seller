// 初始化全局命名空间，实现多文件作用域共享
window.RocheSellerAuction = {
  roche: null,
  container: null,
  isRefreshing: false,
  bidSimulationTimer: null,
  
  // 共享数据状态
  state: {
    activeTab: "auction", // "auction" | "messages" | "mine"
    activePersona: null,
    activeChatId: null,
    items: [],
    chats: {},
    allPersonas: [],
    allChars: [],
    npcRegistry: {},       // 存放 AI 随机生成的动态 NPC 设定
    biddingWars: {}        // 跟踪用户商品的抬价博弈状态 { itemId: { bids: 0, active: true } }
  },
  
  // 子模块占位
  api: {},
  ui: {}
};

(async function bootstrap() {
  const repoBase = "https://raw.githubusercontent.com/wenqv4617-art/roche-seller/main";
  const versionParam = `?v=${Date.now()}`; // 强刷缓存机制

  // 跨域动态加载器
  async function loadModule(fileName) {
    const url = `${repoBase}/${fileName}${versionParam}`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const code = await res.text();
      // 在全局上下文中 eval，确保函数可以安全挂载到 RocheSellerAuction
      (0, eval)(code);
    } catch (e) {
      console.error(`[拍卖会] 加载模块失败: ${fileName}`, e);
    }
  }

  // 并行下载 api.js 和 ui.js
  await Promise.all([
    loadModule("api.js"),
    loadModule("ui.js")
  ]);

  // 向宿主正式注册
  window.RochePlugin.register({
    id: "roche-seller-auction",
    name: "Roche 拍卖会",
    version: "1.2.0",
    apps: [
      {
        id: "roche-seller-auction-home",
        name: "拍卖会",
        icon: "shopping_bag",
        async mount(container, roche) {
          window.RocheSellerAuction.container = container;
          window.RocheSellerAuction.roche = roche;

          // 初始化样式
          window.RocheSellerAuction.ui.injectStyles();

          // 初始化加载数据
          await window.RocheSellerAuction.api.loadData();
          await window.RocheSellerAuction.ui.renderAll();
        },
        async unmount(container, roche) {
          if (window.RocheSellerAuction.bidSimulationTimer) {
            clearTimeout(window.RocheSellerAuction.bidSimulationTimer);
          }
          const style = document.getElementById("roche-seller-auction-styles");
          if (style) {
            style.remove();
          }
          container.replaceChildren();
        }
      }
    ]
  });
})();