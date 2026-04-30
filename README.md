# BOSS直聘 JD采集助手

Chrome浏览器插件，用于批量采集BOSS直聘岗位JD并通过AI分析技术栈和业务关注点。

## 功能

- **批量采集**：在BOSS直聘公司招聘页面一键采集所有技术岗位JD
- **AI分析**：支持Claude和OpenAI，分析岗位JD生成技术栈报告
- **导出报告**：将分析结果导出为Markdown文件

## 安装

1. 打开Chrome浏览器，访问 `chrome://extensions/`
2. 开启右上角的"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择本项目目录

## 使用

1. 打开BOSS直聘某公司的招聘页面
2. 点击浏览器右上角的插件图标
3. 点击"采集岗位"按钮
4. 点击"AI分析"按钮（需要先在设置中配置API Key）
5. 点击"导出报告"按钮下载Markdown文件

## 设置

点击插件弹窗底部的"设置"链接，配置：

- **AI服务**：选择Claude或OpenAI
- **API Key**：输入对应的API密钥
- **模型**：选择AI模型

## 项目结构

```
boss-info/
├── manifest.json          # 插件配置
├── background/
│   └── service-worker.js  # 后台服务
├── content/
│   └── content.js         # 页面数据采集
├── popup/
│   ├── popup.html         # 弹窗UI
│   ├── popup.js
│   └── popup.css
├── options/
│   ├── options.html       # 设置页
│   ├── options.js
│   └── options.css
└── utils/
    └── ai-client.js       # AI调用模块
```

## 注意事项

- API Key仅存储在浏览器本地，不会上传到任何服务器
- 采集频率请适当控制，避免触发BOSS直聘的反爬机制
- 首次使用需要在设置中配置AI API Key
