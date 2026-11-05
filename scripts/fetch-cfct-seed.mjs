#!/usr/bin/env node
/**
 * 拉取《中国食物成分表标准版(第6版)》JSON 种子数据。
 *
 * 用法: node scripts/fetch-cfct-seed.mjs [--ref main]
 * 输出: data/seed/cfct/{categories/*.json, foods.json, gi.json, manifest.json}
 */
import { createHash } from 'node:crypto';
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const REPO = 'Sanotsu/china-food-composition-data';
const DATA_DIR = 'json_data_v3_20260825_qwen38max_kimi_k3_fixed_en';
const GI_PATH = 'json_gi_of_foods/glycemic_index_of_foods.json';
const OUT = path.resolve('data/seed/cfct');
const CONCURRENCY = 8;

const ref = (() => {
  const i = process.argv.indexOf('--ref');
  return i > -1 ? process.argv[i + 1] : 'main';
})();

const headers = { 'User-Agent': 'cfct-seed-fetcher' };

async function api(url) {
  const res = await fetch(url, { headers: { ...headers, Accept: 'application/vnd.github+json' } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${url}`);
  return res.json();
}

async function download(filePath, commit) {
  const url = `https://raw.githubusercontent.com/${REPO}/${commit}/${filePath
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(url, { headers });
    if (res.ok) return res.text();
    if (attempt === 3) throw new Error(`${res.status} ${res.statusText}: ${filePath}`);
    await new Promise((r) => setTimeout(r, 500 * attempt));
  }
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

const sha256 = (text) => createHash('sha256').update(text).digest('hex');

async function main() {
  const commit = await api(`https://api.github.com/repos/${REPO}/commits/${ref}`);
  const sha = commit.sha;
  const tree = await api(`https://api.github.com/repos/${REPO}/git/trees/${sha}?recursive=1`);

  const categoryFiles = tree.tree
    .filter((n) => n.type === 'blob' && n.path.startsWith(`${DATA_DIR}/merged_`) && n.path.endsWith('.json'))
    .map((n) => n.path)
    .sort();
  if (categoryFiles.length === 0) throw new Error('未在源仓库找到分类 JSON 文件');

  await rm(path.join(OUT, 'categories'), { recursive: true, force: true });
  await mkdir(path.join(OUT, 'categories'), { recursive: true });

  const raw = await mapLimit(categoryFiles, CONCURRENCY, async (p) => {
    const text = await download(p, sha);
    const name = path.basename(p);
    JSON.parse(text); // 校验：解析失败即中止
    await writeFile(path.join(OUT, 'categories', name), text, 'utf8');
    return { name, text };
  });

  const foods = [];
  for (const { name } of raw) {
    const base = name.replace(/^merged_/, '').replace(/\.json$/, '');
    const [category, ...rest] = base.split('-');
    const subcategory = rest.join('-');
    const rows = JSON.parse(raw.find((r) => r.name === name).text);
    for (const row of rows) {
      const { foodCode, foodName, englishName, ...rest } = row;
      foods.push({ foodCode, foodName, ...(englishName ? { englishName } : {}), category, subcategory, ...rest });
    }
  }
  foods.sort((a, b) => String(a.foodCode).localeCompare(String(b.foodCode), 'zh-Hans-CN'));

  const giText = await download(GI_PATH, sha);
  const gi = JSON.parse(giText);
  const giOut = JSON.stringify(gi, null, 2) + '\n';
  await writeFile(path.join(OUT, 'gi.json'), giOut, 'utf8');

  const foodsText = JSON.stringify(foods, null, 2) + '\n';
  await writeFile(path.join(OUT, 'foods.json'), foodsText, 'utf8');

  const codes = new Set(foods.map((f) => f.foodCode));
  const manifest = {
    dataset: 'cfct',
    title: '中国食物成分表标准版（第6版）——能量和食物一般营养成分',
    source: {
      repo: `https://github.com/${REPO}`,
      commit: sha,
      commitDate: commit.commit.committer.date,
      sourceDir: DATA_DIR,
      giFile: GI_PATH,
      url: `https://github.com/${REPO}/tree/${sha}/${DATA_DIR}`,
    },
    fetchedAt: new Date().toISOString(),
    counts: {
      categories: categoryFiles.length,
      foods: foods.length,
      uniqueFoodCodes: codes.size,
      withEnglishName: foods.filter((f) => f.englishName).length,
      giGroups: Array.isArray(gi) ? gi.length : undefined,
      giEntries: Array.isArray(gi) ? gi.reduce((n, g) => n + (g.list?.length ?? 0), 0) : undefined,
    },
    files: {
      foods: { path: 'foods.json', bytes: Buffer.byteLength(foodsText), sha256: sha256(foodsText) },
      gi: { path: 'gi.json', bytes: Buffer.byteLength(giOut), sha256: sha256(giOut) },
    },
    license: {
      spdx: 'NOASSERTION',
      note: '源仓库未声明开源许可证；数据整理自《中国食物成分表标准版（第6版）》纸质书，版权归原作者及出版社。仅作学习研究用途，商用需自行获得授权。',
    },
  };
  await writeFile(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');

  console.log(`✓ ${foods.length} 条食物 / ${categoryFiles.length} 个分类 / ${manifest.counts.withEnglishName} 条带英文名`);
  console.log(`  commit ${sha.slice(0, 7)}  ->  ${path.relative(process.cwd(), OUT)}`);
}

main().catch((err) => {
  console.error('✗ 拉取失败:', err.message);
  process.exit(1);
});
