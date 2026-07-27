// 결선은 Task 14에서. 지금은 캔버스가 검게 채워지는지만 확인한다.
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = innerWidth;
canvas.height = innerHeight;
ctx.fillStyle = '#05060d';
ctx.fillRect(0, 0, canvas.width, canvas.height);
