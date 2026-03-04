$(document).ready(function () {
    var answers = [];
    var $container = $('#questions-container');
    var $loading  = $('#loading');
    var $errMsg   = $('#error-msg');

    // 1. 从 Node Function API 加载题目
    $.getJSON('/api/questions', function (questions) {
        $loading.hide();

        // 2. 动态渲染题目表单（与原 Jinja2 模板结构一致）
        $.each(questions, function (idx, q) {
            var idA = 'choice_a_' + idx;
            var idB = 'choice_b_' + idx;
            var form = $(
                '<form class="ac-custom ac-radio ac-circle" autocomplete="off"' +
                ' style="display:' + (idx === 0 ? 'block' : 'none') + '">' +
                '<h2>' + (idx + 1) + '. ' + q.question + '</h2>' +
                '<ul>' +
                '<li>' +
                  '<input id="' + idA + '" name="answer" value="' + q.choice_a.value + '" type="radio">' +
                  '<label for="' + idA + '">' + q.choice_a.text + '</label>' +
                  '<svg viewBox="0 0 100 100"></svg>' +
                '</li>' +
                '<li>' +
                  '<input id="' + idB + '" name="answer" value="' + q.choice_b.value + '" type="radio">' +
                  '<label for="' + idB + '">' + q.choice_b.text + '</label>' +
                  '<svg viewBox="0 0 100 100"></svg>' +
                '</li>' +
                '</ul>' +
                '</form>'
            );
            $container.append(form);
        });

        // 重新初始化 svgcheckbx（如果有的话）
        if (typeof initSvgCheckbox === 'function') {
            initSvgCheckbox();
        }

        // 3. 监听答题，逐题展示，答完后提交
        $container.on('change', "input[name='answer']", function () {
            var answer = $(this).val();
            answers.push(answer);
            var form = $(this).closest('form');
            var nextForm = form.next();
            setTimeout(function () {
                form.remove();
                nextForm.css('display', 'block');
            }, 520);

            if (answers.length === questions.length) {
                // 4. 提交答案到 /api/test
                $.ajax({
                    url: '/api/test',
                    type: 'POST',
                    contentType: 'application/json',
                    data: JSON.stringify({ answers: answers }),
                    success: function (res) {
                        // MBTI 类型目录使用大写，与人格总览页链接一致
                        window.location.href = '/personalities/' + res.result.toUpperCase() + '/';
                    },
                    error: function () {
                        $errMsg.text('提交失败，请刷新页面重试。').show();
                    }
                });
            }
        });

    }).fail(function () {
        $loading.hide();
        $errMsg.text('题目加载失败，请刷新页面重试。').show();
    });
});
