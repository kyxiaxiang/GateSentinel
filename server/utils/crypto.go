package utils

import (
	"encoding/base64"
	"encoding/json"
	"gatesentinel/config"
	"strings"
)

// 标准Base64编码表
const standardBase64Table = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"

// 自定义Base64编码表（打乱的）
const customBase64Table = "QWERTYUIOPASDFGHJKLZXCVBNMqwertyuiopasdfghjklzxcvbnm0123456789+/"

// GetCustomBase64Table 获取自定义Base64编码表
func GetCustomBase64Table() string {
	// 导入config包
	if config.GlobalConfig != nil && config.GlobalConfig.Encoding.UseCustomBase64 {
		return config.GlobalConfig.Encoding.CustomBase64Table
	}
	return standardBase64Table
}

// IsCustomBase64Enabled 检查是否启用自定义Base64编码
func IsCustomBase64Enabled() bool {
	return config.GlobalConfig != nil && config.GlobalConfig.Encoding.UseCustomBase64
}

// CustomBase64Encode 使用自定义编码表进行Base64编码
func CustomBase64Encode(data []byte) string {
	return CustomBase64EncodeWithTable(data, GetCustomBase64Table())
}

// CustomBase64EncodeWithTable 使用指定编码表进行Base64编码
func CustomBase64EncodeWithTable(data []byte, table string) string {
	if len(data) == 0 {
		return ""
	}

	if len(table) != 64 {
		// 如果编码表无效，使用标准编码表
		table = standardBase64Table
	}

	var result strings.Builder

	// 处理完整的3字节组
	for i := 0; i < len(data); i += 3 {
		var b1, b2, b3 byte
		b1 = data[i]

		if i+1 < len(data) {
			b2 = data[i+1]
		}
		if i+2 < len(data) {
			b3 = data[i+2]
		}

		// 转换为4个6位值
		val1 := b1 >> 2
		val2 := ((b1 & 0x03) << 4) | (b2 >> 4)
		val3 := ((b2 & 0x0F) << 2) | (b3 >> 6)
		val4 := b3 & 0x3F

		result.WriteByte(table[val1])
		result.WriteByte(table[val2])

		if i+1 < len(data) {
			result.WriteByte(table[val3])
		} else {
			result.WriteByte('=')
		}

		if i+2 < len(data) {
			result.WriteByte(table[val4])
		} else {
			result.WriteByte('=')
		}
	}

	return result.String()
}

// CustomBase64Decode 使用自定义编码表进行Base64解码
func CustomBase64Decode(input string) ([]byte, error) {
	return CustomBase64DecodeWithTable(input, GetCustomBase64Table())
}

// CustomBase64DecodeWithTable 使用指定编码表进行Base64解码
func CustomBase64DecodeWithTable(input string, table string) ([]byte, error) {
	if len(input) == 0 {
		return nil, nil
	}

	if len(input)%4 != 0 {
		return nil, base64.CorruptInputError(len(input))
	}

	if len(table) != 64 {
		// 如果编码表无效，使用标准编码表
		table = standardBase64Table
	}

	// 计算填充字符数量
	padding := 0
	if len(input) > 0 {
		if input[len(input)-1] == '=' {
			padding++
		}
		if len(input) > 1 && input[len(input)-2] == '=' {
			padding++
		}
	}

	outputLen := (len(input)/4)*3 - padding
	output := make([]byte, outputLen)

	j := 0
	for i := 0; i < len(input); i += 4 {
		var val uint32

		for k := 0; k < 4; k++ {
			c := input[i+k]
			var digit int

			if c == '=' {
				digit = 0
			} else {
				// 在指定编码表中查找字符位置
				digit = strings.IndexByte(table, c)
				if digit == -1 {
					return nil, base64.CorruptInputError(i + k)
				}
			}

			val = (val << 6) | uint32(digit)
		}

		// 提取3个字节
		if j < len(output) {
			output[j] = byte(val >> 16)
			j++
		}
		if j < len(output) {
			output[j] = byte(val >> 8)
			j++
		}
		if j < len(output) {
			output[j] = byte(val)
			j++
		}
	}

	return output, nil
}

// EncodeBase64 将数据编码为Base64字符串
func EncodeBase64(data interface{}) (string, error) {
	jsonData, err := json.Marshal(data)
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(jsonData), nil
}

// DecodeBase64 将Base64字符串解码为结构体
func DecodeBase64(str string, v interface{}) error {
	data, err := base64.StdEncoding.DecodeString(str)
	if err != nil {
		return err
	}
	return json.Unmarshal(data, v)
}

// WrapDataWithDisguise 使用配置的前缀和后缀包装数据
func WrapDataWithDisguise(data string) string {
	if config.GlobalConfig == nil || !config.GlobalConfig.TrafficDisguise.Enable {
		return data
	}

	prefix := config.GlobalConfig.TrafficDisguise.Prefix
	suffix := config.GlobalConfig.TrafficDisguise.Suffix

	return prefix + data + suffix
}

// UnwrapDataFromDisguise 移除配置的前缀和后缀，恢复原始数据
func UnwrapDataFromDisguise(wrappedData string) string {
	if config.GlobalConfig == nil || !config.GlobalConfig.TrafficDisguise.Enable {
		return wrappedData
	}

	prefix := config.GlobalConfig.TrafficDisguise.Prefix
	suffix := config.GlobalConfig.TrafficDisguise.Suffix

	// 检查是否有前缀和后缀
	if len(wrappedData) < len(prefix)+len(suffix) {
		return wrappedData // 数据太短，无法包含前缀和后缀
	}

	// 检查前缀
	if !strings.HasPrefix(wrappedData, prefix) {
		return wrappedData // 没有预期的前缀
	}

	// 检查后缀
	if !strings.HasSuffix(wrappedData, suffix) {
		return wrappedData // 没有预期的后缀
	}

	// 移除前缀和后缀
	data := wrappedData[len(prefix) : len(wrappedData)-len(suffix)]
	return data
}

// IsTrafficDisguiseEnabled 检查是否启用了流量伪装
func IsTrafficDisguiseEnabled() bool {
	return config.GlobalConfig != nil && config.GlobalConfig.TrafficDisguise.Enable
}
