// File path: node-functions/api/test.js
// Access path: example.com/api/test
// 接收答案数组，计算并返回 MBTI 类型（POST）

export const onRequestPost = async ({ request }) => {
  try {
    // 支持 JSON 或 application/x-www-form-urlencoded 两种提交方式
    let answers;
    const contentType = request.headers.get('Content-Type') || '';

    if (contentType.includes('application/json')) {
      const body = await request.json();
      answers = body.answers ?? body;
    } else {
      const text = await request.text();
      const params = new URLSearchParams(text);
      const raw = params.get('answers');
      answers = JSON.parse(raw);
    }

    if (!Array.isArray(answers) || answers.length !== 72) {
      return new Response(
        JSON.stringify({ error: '需要 72 个答案' }),
        { status: 400, headers: { 'Content-Type': 'application/json; charset=UTF-8' } }
      );
    }

    const result = calcMbti(answers);
    return new Response(JSON.stringify({ result }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json; charset=UTF-8' } }
    );
  }
};

/**
 * 计算 MBTI 类型
 * 维度对: E-I  S-N  T-F  J-P
 * 哪个字母出现次数 >= 另一个，则取前者，否则取后者
 */
function calcMbti(answers) {
  const types = [['E', 'I'], ['S', 'N'], ['T', 'F'], ['J', 'P']];
  const count = {};
  for (const a of answers) count[a] = (count[a] || 0) + 1;

  return types
    .map(([t1, t2]) => ((count[t1] || 0) >= (count[t2] || 0) ? t1 : t2))
    .join('');
}
