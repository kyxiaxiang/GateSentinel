# 贡献指南 / Contributing Guide

[English](#english) | [中文](#中文)

---

## 中文

### 🤝 如何贡献

感谢您对 GateSentinel 项目的关注！我们欢迎各种形式的贡献。

### 📋 贡献类型

#### 1. 问题报告
- **严重 Bug**: 请立即通过 GitHub Issues 报告
- **功能请求**: 通过 GitHub Issues 提交
- **一般问题**: 可在知识星球进行讨论

#### 2. 代码贡献
- **Bug 修复**: Fork 项目并提交 Pull Request
- **新功能**: 先在 Issues 中讨论，然后提交 PR
- **文档改进**: 帮助完善文档和示例

#### 3. 测试反馈
- 在不同环境下测试项目
- 报告兼容性问题
- 提供性能测试结果

### 🔧 开发环境设置

#### 服务端开发
```bash
# 克隆项目
git clone https://github.com/kyxiaxiang/GateSentinel.git
cd GateSentinel

# 安装依赖
cd server
go mod tidy

# 运行测试
go test ./...

# 构建
go build -o gatesentinel
```

#### 客户端开发
```bash
# Windows 环境 (需要 MinGW 或 Visual Studio)
cd beacon
gcc -o beacon.exe beacon.c http.c tasks.c utils.c -lwininet -ladvapi32 -lkernel32 -luser32 -DUNICODE -D_UNICODE
```

### 📝 代码规范

#### Go 代码规范
- 使用 `gofmt` 格式化代码
- 遵循 Go 官方编码规范
- 添加适当的注释
- 编写单元测试

#### C 代码规范
- 使用一致的缩进 (4 个空格)
- 函数和变量命名使用下划线分隔
- 添加必要的错误处理
- 避免内存泄漏

### 🚀 提交流程

1. **Fork 项目**
   ```bash
   # 在 GitHub 上 Fork 项目
   git clone https://github.com/your-username/GateSentinel.git
   ```

2. **创建分支**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **提交更改**
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```

4. **推送分支**
   ```bash
   git push origin feature/your-feature-name
   ```

5. **创建 Pull Request**
   - 在 GitHub 上创建 PR
   - 详细描述更改内容
   - 关联相关的 Issues

### 📋 提交信息规范

使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

- `feat:` 新功能
- `fix:` Bug 修复
- `docs:` 文档更新
- `style:` 代码格式调整
- `refactor:` 代码重构
- `test:` 测试相关
- `chore:` 构建过程或辅助工具的变动

### ⚠️ 注意事项

- 确保代码符合项目的安全要求
- 不要提交敏感信息 (密钥、密码等)
- 测试您的更改在不同环境下的兼容性
- 遵守开源协议和法律法规

---

## English

### 🤝 How to Contribute

Thank you for your interest in the GateSentinel project! We welcome all forms of contributions.

### 📋 Types of Contributions

#### 1. Issue Reporting
- **Critical Bugs**: Report immediately via GitHub Issues
- **Feature Requests**: Submit through GitHub Issues
- **General Questions**: Discuss in our Knowledge Planet community

#### 2. Code Contributions
- **Bug Fixes**: Fork the project and submit Pull Requests
- **New Features**: Discuss in Issues first, then submit PR
- **Documentation**: Help improve documentation and examples

#### 3. Testing Feedback
- Test the project in different environments
- Report compatibility issues
- Provide performance testing results

### 🔧 Development Environment Setup

#### Server Development
```bash
# Clone the project
git clone https://github.com/kyxiaxiang/GateSentinel.git
cd GateSentinel

# Install dependencies
cd server
go mod tidy

# Run tests
go test ./...

# Build
go build -o gatesentinel
```

#### Client Development
```bash
# Windows environment (requires MinGW or Visual Studio)
cd beacon
gcc -o beacon.exe beacon.c http.c tasks.c utils.c -lwininet -ladvapi32 -lkernel32 -luser32 -DUNICODE -D_UNICODE
```

### 📝 Code Standards

#### Go Code Standards
- Use `gofmt` to format code
- Follow official Go coding standards
- Add appropriate comments
- Write unit tests

#### C Code Standards
- Use consistent indentation (4 spaces)
- Use underscore-separated naming for functions and variables
- Add necessary error handling
- Avoid memory leaks

### 🚀 Submission Process

1. **Fork the Project**
2. **Create a Branch**
3. **Commit Changes**
4. **Push Branch**
5. **Create Pull Request**

### 📋 Commit Message Standards

Use [Conventional Commits](https://www.conventionalcommits.org/) specification:

- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation updates
- `style:` Code formatting
- `refactor:` Code refactoring
- `test:` Testing related
- `chore:` Build process or auxiliary tool changes

### ⚠️ Important Notes

- Ensure code meets project security requirements
- Do not commit sensitive information (keys, passwords, etc.)
- Test your changes for compatibility across different environments
- Comply with open source licenses and legal regulations
