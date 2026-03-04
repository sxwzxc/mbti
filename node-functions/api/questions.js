// File path: node-functions/api/questions.js
// Access path: example.com/api/questions
// 返回所有测试题目（随机打乱顺序）
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadQuestions() {
  // 路径相对于项目根目录（edgeone.json 中配置了 included_files: data/**）
  const txtPath = path.resolve(__dirname, '../../data/questions.txt');
  const content = readFileSync(txtPath, 'utf-8');

  const questions = [];
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // 每行格式：题目<空白>选项A文字+字母<空白>选项B文字+字母
    // 中文文本内部不含空格，直接用 split(/\s+/) 拆出恰好 3 部分
    const parts = trimmed.split(/\s+/);
    if (parts.length < 3) continue;

    // 若 split 产生多于 3 段（理论上不会），则取最后两段作为选项
    const choiceBRaw = parts[parts.length - 1];
    const choiceARaw = parts[parts.length - 2];
    const question   = parts.slice(0, parts.length - 2).join(' ');
    questions.push({
      question,
      choice_a: { value: choiceARaw.slice(-1), text: choiceARaw.slice(0, -1) },
      choice_b: { value: choiceBRaw.slice(-1), text: choiceBRaw.slice(0, -1) },
    });
  }
  return questions;
}

// 随机打乱数组（Fisher-Yates 算法）
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const onRequestGet = async () => {
  try {
    const questions = shuffle(loadQuestions());
    return new Response(JSON.stringify(questions), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    });
  }
};
