// 获取DOM元素
const elements = {
    minNumber: document.getElementById('minNumber'),
    maxNumber: document.getElementById('maxNumber'),
    opAdd: document.getElementById('opAdd'),
    opSub: document.getElementById('opSub'),
    opMul: document.getElementById('opMul'),
    opDiv: document.getElementById('opDiv'),
    questionCount: document.getElementById('questionCount'),
    columnsCount: document.getElementById('columnsCount'),
    noNegative: document.getElementById('noNegative'),
    noDivRemainder: document.getElementById('noDivRemainder'),
    showAnswers: document.getElementById('showAnswers'),
    generateBtn: document.getElementById('generateBtn'),
    printBtn: document.getElementById('printBtn'),
    questionsContainer: document.getElementById('questionsContainer'),
    answersSection: document.getElementById('answersSection'),
    answersContainer: document.getElementById('answersContainer')
};

// 运算符映射
const operators = {
    add: { symbol: '+', name: '加法' },
    sub: { symbol: '-', name: '减法' },
    mul: { symbol: '×', name: '乘法' },
    div: { symbol: '÷', name: '除法' }
};

// 生成随机整数
function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// 获取启用的运算类型
function getEnabledOperations() {
    const ops = [];
    if (elements.opAdd.checked) ops.push('add');
    if (elements.opSub.checked) ops.push('sub');
    if (elements.opMul.checked) ops.push('mul');
    if (elements.opDiv.checked) ops.push('div');
    return ops;
}

// 生成单道题目
function generateQuestion(min, max, operation, noNegative, noDivRemainder) {
    let num1, num2, answer;
    const op = operators[operation];
    let attempts = 0;
    const maxAttempts = 100;

    do {
        attempts++;
        if (attempts > maxAttempts) {
            // 如果尝试次数过多，返回简单的加法
            num1 = randomInt(min, max);
            num2 = randomInt(min, max);
            return { num1, num2, operator: '+', answer: num1 + num2 };
        }

        switch (operation) {
            case 'add':
                num1 = randomInt(min, max);
                num2 = randomInt(min, max);
                answer = num1 + num2;
                break;

            case 'sub':
                num1 = randomInt(min, max);
                num2 = randomInt(min, max);
                if (noNegative && num1 < num2) {
                    [num1, num2] = [num2, num1]; // 交换确保结果非负
                }
                answer = num1 - num2;
                break;

            case 'mul':
                // 乘法时限制一个数较小，避免结果过大
                const mulMax = Math.min(max, 12);
                num1 = randomInt(Math.max(1, min), mulMax);
                num2 = randomInt(Math.max(1, min), mulMax);
                answer = num1 * num2;
                break;

            case 'div':
                // 除法：先生成结果和除数，再计算被除数
                if (noDivRemainder) {
                    const divMax = Math.min(max, 12);
                    num2 = randomInt(Math.max(1, min), divMax); // 除数
                    answer = randomInt(1, divMax); // 商
                    num1 = num2 * answer; // 被除数
                } else {
                    num2 = randomInt(Math.max(1, min), max);
                    num1 = randomInt(min, max);
                    answer = num1 / num2;
                }
                break;
        }
    } while (operation === 'div' && num2 === 0);

    return { num1, num2, operator: op.symbol, answer };
}

// 生成所有题目
function generateAllQuestions() {
    const min = parseInt(elements.minNumber.value) || 1;
    const max = parseInt(elements.maxNumber.value) || 100;
    const count = parseInt(elements.questionCount.value);
    const columns = parseInt(elements.columnsCount.value);
    const noNegative = elements.noNegative.checked;
    const noDivRemainder = elements.noDivRemainder.checked;
    const showAnswers = elements.showAnswers.checked;
    const enabledOps = getEnabledOperations();

    if (enabledOps.length === 0) {
        alert('请至少选择一种运算类型！');
        return;
    }

    if (min > max) {
        alert('最小值不能大于最大值！');
        return;
    }

    const questions = [];
    const usedQuestions = new Set(); // 用于去重

    for (let i = 0; i < count; i++) {
        let question;
        let questionKey;
        let attempts = 0;

        // 尝试生成不重复的题目
        do {
            attempts++;
            const operation = enabledOps[randomInt(0, enabledOps.length - 1)];
            question = generateQuestion(min, max, operation, noNegative, noDivRemainder);
            questionKey = `${question.num1}${question.operator}${question.num2}`;
        } while (usedQuestions.has(questionKey) && attempts < 50);

        usedQuestions.add(questionKey);
        questions.push(question);
    }

    // 渲染题目
    renderQuestions(questions, columns, showAnswers);
}

// 渲染题目到页面
function renderQuestions(questions, columns, showAnswers) {
    elements.questionsContainer.innerHTML = '';
    elements.questionsContainer.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;

    questions.forEach((q, index) => {
        const item = document.createElement('div');
        item.className = 'question-item';
        
        const answerDisplay = showAnswers 
            ? `<span class="answer-value">${formatAnswer(q.answer)}</span>`
            : '<span class="answer-blank"></span>';

        item.innerHTML = `
            <span class="question-number">${index + 1}.</span>
            <span class="question-content">${q.num1} ${q.operator} ${q.num2} = ${answerDisplay}</span>
        `;
        elements.questionsContainer.appendChild(item);
    });

    // 渲染答案区域（单独显示）
    if (showAnswers) {
        elements.answersSection.style.display = 'block';
        elements.answersContainer.innerHTML = '';
        
        questions.forEach((q, index) => {
            const item = document.createElement('span');
            item.className = 'answer-item';
            item.innerHTML = `<span class="num">${index + 1}.</span> <span class="val">${formatAnswer(q.answer)}</span>`;
            elements.answersContainer.appendChild(item);
        });
    } else {
        elements.answersSection.style.display = 'none';
    }
}

// 格式化答案
function formatAnswer(answer) {
    if (Number.isInteger(answer)) {
        return answer;
    }
    return answer.toFixed(2);
}

// 打印功能
function printWorksheet() {
    if (elements.questionsContainer.children.length === 0) {
        alert('请先生成题目！');
        return;
    }
    window.print();
}

// 绑定事件
elements.generateBtn.addEventListener('click', generateAllQuestions);
elements.printBtn.addEventListener('click', printWorksheet);

// 页面加载时自动生成一次
document.addEventListener('DOMContentLoaded', () => {
    generateAllQuestions();
});
