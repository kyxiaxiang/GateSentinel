# 安全政策 / Security Policy

[English](#english) | [中文](#中文)

---

## 中文

### 🔒 安全声明

GateSentinel 是一个专为安全研究和授权渗透测试设计的 C2 框架。我们严肃对待安全问题，并致力于负责任地处理所有安全相关事宜。

### ⚠️ 使用限制

**本项目仅限于以下合法用途：**

- ✅ 授权的安全测试和渗透测试
- ✅ 安全研究和教育目的
- ✅ 红队演练和安全评估
- ✅ 个人学习和技能提升

**严禁用于以下非法活动：**

- ❌ 未经授权的系统入侵
- ❌ 恶意软件传播
- ❌ 数据窃取或破坏
- ❌ 任何违法犯罪活动

### 🛡️ 安全特性

#### 当前安全措施
- **流量加密**: 支持 HTTPS/TLS 加密传输
- **流量伪装**: 将 C2 流量伪装为正常 Web 流量
- **自定义编码**: 使用混淆的 Base64 编码表
- **访问控制**: Web 管理界面需要身份验证
- **配置安全**: 敏感配置项支持环境变量

#### 计划中的安全增强
- **证书固定**: 防止中间人攻击
- **多重身份验证**: 增强管理界面安全性
- **审计日志**: 完整的操作审计记录
- **权限分离**: 细粒度的权限控制

### 🚨 漏洞报告

如果您发现了安全漏洞，请负责任地向我们报告：

#### 报告渠道
1. **GitHub Security Advisories** (推荐)
   - 访问项目的 Security 标签页
   - 点击 "Report a vulnerability"
   - 填写详细的漏洞信息

2. **私人邮件报告**
   - 发送邮件至项目维护者
   - 邮件标题包含 "[SECURITY]" 前缀
   - 详细描述漏洞信息

#### 报告内容应包括
- 漏洞的详细描述
- 重现步骤
- 影响范围和严重程度
- 可能的修复建议
- 您的联系方式

### 📋 漏洞处理流程

1. **确认收到** (24小时内)
   - 我们会在 24 小时内确认收到您的报告
   - 分配唯一的跟踪编号

2. **初步评估** (72小时内)
   - 评估漏洞的真实性和严重程度
   - 确定修复优先级

3. **修复开发** (根据严重程度)
   - 严重漏洞: 7 天内
   - 高危漏洞: 14 天内
   - 中危漏洞: 30 天内
   - 低危漏洞: 60 天内

4. **发布修复** 
   - 发布安全更新
   - 发布安全公告
   - 致谢报告者 (如同意)

### 🏆 致谢政策

我们感谢负责任地报告安全漏洞的研究人员：

- 在安全公告中公开致谢 (如您同意)
- 在项目 README 的贡献者列表中列出
- 优先考虑您未来的功能请求

### 📞 联系方式

- **安全问题**: GitHub Security Advisories
- **一般问题**: GitHub Issues
- **技术交流**: 知识星球社区

---

## English

### 🔒 Security Statement

GateSentinel is a C2 framework designed specifically for security research and authorized penetration testing. We take security issues seriously and are committed to handling all security-related matters responsibly.

### ⚠️ Usage Restrictions

**This project is limited to the following legal uses:**

- ✅ Authorized security testing and penetration testing
- ✅ Security research and educational purposes
- ✅ Red team exercises and security assessments
- ✅ Personal learning and skill development

**Strictly prohibited for the following illegal activities:**

- ❌ Unauthorized system intrusion
- ❌ Malware distribution
- ❌ Data theft or destruction
- ❌ Any illegal criminal activities

### 🛡️ Security Features

#### Current Security Measures
- **Traffic Encryption**: HTTPS/TLS encrypted transmission support
- **Traffic Disguise**: Disguise C2 traffic as normal web traffic
- **Custom Encoding**: Obfuscated Base64 encoding tables
- **Access Control**: Web management interface requires authentication
- **Configuration Security**: Sensitive configuration items support environment variables

#### Planned Security Enhancements
- **Certificate Pinning**: Prevent man-in-the-middle attacks
- **Multi-Factor Authentication**: Enhanced management interface security
- **Audit Logging**: Complete operational audit records
- **Permission Separation**: Fine-grained permission control

### 🚨 Vulnerability Reporting

If you discover a security vulnerability, please report it to us responsibly:

#### Reporting Channels
1. **GitHub Security Advisories** (Recommended)
2. **Private Email Report**

#### Report Content Should Include
- Detailed description of the vulnerability
- Reproduction steps
- Impact scope and severity
- Possible fix suggestions
- Your contact information

### 📋 Vulnerability Handling Process

1. **Acknowledgment** (within 24 hours)
2. **Initial Assessment** (within 72 hours)
3. **Fix Development** (based on severity)
4. **Release Fix**

### 🏆 Acknowledgment Policy

We appreciate security researchers who responsibly report vulnerabilities:

- Public acknowledgment in security announcements (if you agree)
- Listed in the project README contributors list
- Priority consideration for your future feature requests

### 📞 Contact Information

- **Security Issues**: GitHub Security Advisories
- **General Issues**: GitHub Issues
- **Technical Discussion**: Knowledge Planet Community
