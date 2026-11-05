# 中国食物成分表（种子数据）

《中国食物成分表标准版（第 6 版）》「能量和食物一般营养成分」部分的 JSON 数据集，
用于本项目的种子数据（seed data）。

## 来源

| 项目 | 值 |
| --- | --- |
| 源仓库 | [Sanotsu/china-food-composition-data](https://github.com/Sanotsu/china-food-composition-data) |
| 数据目录 | `json_data_v3_20260825_qwen38max_kimi_k3_fixed_en`（人工矫正 + 英文名增强版） |
| 锁定版本 | 见 `manifest.json` 的 `source.commit` |
| 条数 | 1677 条食物 / 61 个分类，其中 1242 条带英文名 |

源数据由双视觉模型识别原书截图、交叉校验并人工复核生成；`fixed` 版还修正了原书
「蔬菜类-野生蔬菜类」中能量 kcal / kJ 标反的问题。

## 文件

```
data/seed/cfct/
├── foods.json        # 合并后的单文件种子（按 foodCode 排序），导入就用这个
├── categories/       # 61 个原始分类文件，逐字节保留源仓库内容
├── gi.json           # 食物升糖指数（GI）表，11 组共 259 条
└── manifest.json     # 版本、条数、文件 sha256、许可证说明
```

`foods.json` 每条在原始字段之外附加两个字段：

- `category` —— 顶层分类，如 `水果类及其制品`
- `subcategory` —— 子分类，如 `仁果类`

## 字段

| 字段 | 含义 | 单位 |
| --- | --- | --- |
| `foodCode` | 食物编码 | — |
| `foodName` / `englishName` | 中文名 / 英文名 | — |
| `edible` | 可食部 | % |
| `water` | 水分 | g/100g |
| `energyKCal` / `energyKJ` | 能量 | kcal、kJ |
| `protein` / `fat` / `CHO` | 蛋白质 / 脂肪 / 碳水化合物 | g/100g |
| `dietaryFiber` / `ash` / `cholesterol` | 膳食纤维 / 灰分 / 胆固醇 | g/100g、mg/100g |
| `vitaminA` / `carotene` / `retinol` | 维生素 A / 胡萝卜素 / 视黄醇 | μgRAE、μg、μg |
| `thiamin` / `riboflavin` / `niacin` / `vitaminC` | 硫胺素 / 核黄素 / 烟酸 / 维生素 C | mg/100g |
| `vitaminETotal` / `vitaminE1` / `vitaminE2` / `vitaminE3` | 维生素 E 总量及 α/β/γ 生育酚 | mg/100g |
| `Ca` / `P` / `K` / `Na` / `Mg` / `Fe` / `Zn` / `Se` / `Cu` / `Mn` | 矿物质 | mg/100g（Se 为 μg） |
| `remark` | 备注（产地、品种等） | — |

**数值均为字符串且保留原书精度**，缺失值可能为 `—`（未测定）、`Tr`（微量）、
`(0.03)`（括号表示估算值）。入库/计算前请自行解析，不要直接 `Number()`。

## 重新拉取 / 更新

```sh
node scripts/fetch-cfct-seed.mjs              # 跟随 main
node scripts/fetch-cfct-seed.mjs --ref <sha>  # 锁定某个提交
```

脚本会重写 `categories/`、`foods.json`、`gi.json`、`manifest.json`，并重新计算校验和。

## 许可证

源仓库**未声明开源许可证**，数据整理自正式出版物，版权归原作者及出版社所有。
本项目仅将其作为学习研究用途的种子数据；商用或再分发前请自行取得授权。
