class BlockMergeGame {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Размеры игрового поля
        this.gridWidth = 6;
        this.gridHeight = 8; // 6 основных строк + 1 зона предупреждения + 1 зона сползания
        this.playableHeight = 6; // Высота игрового поля без зон смерти и сползания
        this.cellSize = 55; // Увеличен размер блоков для мобильных
        this.padding = 20;
        
        // Игровое состояние
        this.grid = this.createEmptyGrid();
        this.currentBlock = null;
        this.nextBlocks = [2, 4, 2];
        this.score = 0;
        this.bestScore = this.loadBestScore();
        this.coins = 320;
        this.isGameRunning = true;
        this.isBlockFalling = false;
        
        // Система комбо
        this.comboCount = 0;
        this.comboMultiplier = 1;
        this.isProcessingMerges = false;
        
        // Система целей и прогрессии
        this.currentGoal = 512;
        this.availableBlocks = [2, 4, 8, 16, 32, 64];
        this.goalAchieved = false;
        this.initialGoalShown = false;
        
        // Система анимации слияния
        this.mergeAnimations = [];
        this.animationStartTime = 0;
        
        // Система предупреждения о переполнении
        this.dangerousColumns = new Set();
        
        // Система сползания блоков
        this.slidingBlock = null; // блок который сползает
        this.baseSlidingSpeed = 0.001; // базовая скорость сползания (в 20 раз медленнее)
        this.currentSlidingSpeed = this.baseSlidingSpeed;
        this.isSliding = false;
        this.lastDropColumn = Math.floor(this.gridWidth / 2); // последний столбец где упал блок
        this.isPaused = false; // состояние паузы
        
        // Цвета блоков
        this.blockColors = {
            2: '#3f83f8',
            4: '#10b981', 
            8: '#f59e0b',
            16: '#ef4444',
            32: '#8b5cf6',
            64: '#ec4899',
            128: '#06b6d4',
            256: '#84cc16',
            512: '#f97316',
            1024: '#6366f1',
            2048: '#e11d48',
            4096: '#059669',
            8192: '#7c3aed',
            16384: '#dc2626'
        };
        
        this.init();
    }
    
    init() {
        this.updateDisplay();
        this.setupEventListeners();
        this.gameLoop();
        
        // Показываем начальную цель через небольшую задержку
        setTimeout(() => {
            this.showInitialGoal();
        }, 500);
    }
    
    setupEventListeners() {
        // Обработчики для canvas (клик и тач)
        this.canvas.addEventListener('click', (e) => {
            if (this.isPaused) return;
            const column = this.getColumnFromCoordinate(e.offsetX);
            this.dropBlockInColumn(column);
        });

        this.canvas.addEventListener('touchend', (e) => {
            if (this.isPaused) return;
            e.preventDefault();
            const rect = this.canvas.getBoundingClientRect();
            const touch = e.changedTouches[0];
            const x = touch.clientX - rect.left;
            const column = this.getColumnFromCoordinate(x);
            this.dropBlockInColumn(column);
        });
        
        // Обработчики клавиатуры для столбцов 1-6
        document.addEventListener('keydown', (e) => {
            if (this.isPaused) return;
            const key = parseInt(e.key);
            if (key >= 1 && key <= 6) {
                this.dropBlockInColumn(key - 1);
            }
        });
        
        // Кнопка рестарта
        const restartBtn = document.getElementById('restart-btn');
        if (restartBtn) {
            restartBtn.addEventListener('click', () => {
                this.restartGame();
            });
        }
        
        // Кнопка паузы
        const pauseBtn = document.getElementById('pause-btn');
        if (pauseBtn) {
            pauseBtn.addEventListener('click', () => {
                this.togglePause();
            });
        }
    }
    
    getColumnFromCoordinate(x) {
        return Math.floor((x - this.padding) / this.cellSize);
    }
    
    dropBlockInColumn(column) {
        if (this.isPaused) return;
        if (column < 0 || column >= this.gridWidth) return;
        
        // Если блок сползает, перенаправляем его
        if (this.isSliding && this.slidingBlock) {
            this.redirectSlidingBlock(column);
            return;
        }
        
        // Если ничего не сползает, начинаем новое сползание
        if (!this.isSliding) {
            this.startSliding(column);
        }
    }
    
    startSliding(targetColumn) {
        if (this.isPaused || this.isSliding) return;
        
        // Проверяем, можно ли бросить блок в этот столбец
        if (!this.canDropInColumn(targetColumn)) {
            this.gameOver();
            return;
        }
        
        // Берем блок из очереди
        const blockValue = this.nextBlocks.pop();
        this.nextBlocks.unshift(this.generateNextBlockValue());
        this.updateNextBlocks();
        
        // Создаем сползающий блок
        this.slidingBlock = {
            value: blockValue,
            x: this.lastDropColumn,
            y: 0, // строка сползания
            targetX: targetColumn,
            progress: 0
        };
        
        this.isSliding = true;
    }
    
    startAutoSliding(preferredColumn = null) {
        if (this.isPaused || this.isSliding) return;
        
        // Используем предпочитаемый столбец или последний столбец падения
        const targetColumn = preferredColumn !== null ? preferredColumn : this.lastDropColumn;
        
        // Проверяем, можно ли бросить блок в этот столбец
        if (!this.canDropInColumn(targetColumn)) {
            // Ищем первый доступный столбец
            let foundColumn = -1;
            for (let col = 0; col < this.gridWidth; col++) {
                if (this.canDropInColumn(col)) {
                    foundColumn = col;
                    break;
                }
            }
            
            if (foundColumn === -1) {
                this.gameOver();
                return;
            }
            
            this.startSliding(foundColumn);
        } else {
            this.startSliding(targetColumn);
        }
    }
    
    redirectSlidingBlock(newColumn) {
        if (!this.slidingBlock || this.isPaused) return;
        
        // Проверяем, можно ли бросить блок в новый столбец
        if (!this.canDropInColumn(newColumn)) {
            this.gameOver();
            return;
        }
        
        // Конвертируем сползающий блок в падающий
        this.currentBlock = {
            value: this.slidingBlock.value,
            x: newColumn,
            y: 1, // начинаем падение с зоны смерти
            targetY: this.findDropPosition(newColumn),
            speed: 0.5, // Увеличена скорость для одинаковой скорости на всех устройствах
            animationProgress: 0
        };
        
        // Очищаем сползание
        this.slidingBlock = null;
        this.isSliding = false;
        this.isBlockFalling = true;
        
        // Начинаем анимацию быстрого падения
        this.animateBlockDrop();
    }
    
    canDropInColumn(column) {
        if (column < 0 || column >= this.gridWidth) return false;
        // Проверяем, есть ли место в первой игровой строке (строка 1)
        return this.grid[1][column] === 0;
    }
    
    findDropPosition(column) {
        // Ищем самую нижнюю свободную позицию в столбце (строки 1-7)
        for (let row = this.gridHeight - 1; row >= 1; row--) {
            if (this.grid[row][column] === 0) {
                return row;
            }
        }
        // Если нет места, возвращаем зону сползания (игра должна закончиться)
        return 0;
    }
    
    animateBlockDrop() {
        if (!this.currentBlock || this.isPaused) return;
        
        this.currentBlock.animationProgress += this.currentBlock.speed;
        
        if (this.currentBlock.animationProgress >= 1) {
            this.currentBlock.y = this.currentBlock.targetY;
            this.landBlock();
        } else {
            const startY = 1;
            const endY = this.currentBlock.targetY;
            this.currentBlock.y = startY + (endY - startY) * this.easeOutBounce(this.currentBlock.animationProgress);
            
            requestAnimationFrame(() => this.animateBlockDrop());
        }
    }
    
    generateNextBlockValue() {
        // Используем взвешенную случайную генерацию для более равномерного распределения
        const weights = {};
        const totalBlocks = this.availableBlocks.length;
        
        // Создаем веса с небольшим уклоном к меньшим числам
        this.availableBlocks.forEach((value, index) => {
            weights[value] = totalBlocks - index + 1; // Больший вес для меньших чисел
        });
        
        const totalWeight = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
        let random = Math.random() * totalWeight;
        
        for (const [value, weight] of Object.entries(weights)) {
            random -= weight;
            if (random <= 0) {
                return parseInt(value);
            }
        }
        
        return this.availableBlocks[0];
    }
    
    landBlock() {
        if (!this.currentBlock) return;
        
        const { x, y, value } = this.currentBlock;
        
        // Проверяем, попал ли блок в зону сползания (игра заканчивается)
        if (y <= 0) {
            this.gameOver();
            return;
        }
        
        // Размещаем блок на поле
        this.grid[y][x] = value;
        this.currentBlock = null;
        this.isBlockFalling = false;
        
        // Обновляем последний столбец падения
        this.lastDropColumn = x;
        
        // Проверяем мерджи
        this.checkMerges();
        
        // Проверяем опасные столбцы
        this.checkDangerousColumns();
        
        // Проверяем условие окончания игры
        this.checkGameOver();
        
        // Если нет ожидающих мерджей, начинаем следующее сползание
        if (!this.isProcessingMerges) {
            setTimeout(() => {
                this.startAutoSliding();
            }, 100);
        }
    }
    
    landSlidingBlock() {
        if (!this.slidingBlock) return;
        
        const { targetX, value } = this.slidingBlock;
        const targetY = this.findDropPosition(targetX);
        
        // Проверяем, попал ли блок в зону смерти
        if (targetY <= 1) {
            this.gameOver();
            return;
        }
        
        // Размещаем блок на поле
        this.grid[targetY][targetX] = value;
        
        // Обновляем последний столбец падения
        this.lastDropColumn = targetX;
        
        // Очищаем сползание
        this.slidingBlock = null;
        this.isSliding = false;
        
        // Проверяем мерджи
        this.checkMerges();
        
        // Проверяем опасные столбцы
        this.checkDangerousColumns();
        
        // Проверяем условие окончания игры
        this.checkGameOver();
        
        // Если нет ожидающих мерджей, начинаем следующее сползание
        if (!this.isProcessingMerges) {
            setTimeout(() => {
                this.startAutoSliding();
            }, 100);
        }
    }
    
    checkGameOver() {
        // Игра окончена, если в любом столбце во второй строке (первая игровая) есть блок
        for (let col = 0; col < this.gridWidth; col++) {
            if (this.grid[2][col] !== 0) {
                return false; // Есть хотя бы один свободный столбец
            }
        }
        this.gameOver();
        return true;
    }
    
    checkMerges() {
        this.processMergeChain();
    }
    
    async processMergeChain() {
        this.isProcessingMerges = true;
        let mergeCount = 0;
        
        while (true) {
            const merges = this.findAllMerges();
            
            if (merges.length === 0) {
                break;
            }
            
            mergeCount++;
            
            // Применяем мерджи
            this.applyMerges(merges);
            
            // Применяем гравитацию
            this.applyGravity();
            
            // Показываем комбо если больше 1 мерджа
            if (mergeCount > 1) {
                this.showCombo(mergeCount);
            }
            
            // Проверяем опасные столбцы после гравитации
            this.checkDangerousColumns();
            
            // Небольшая задержка для визуального эффекта
            await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        this.isProcessingMerges = false;
        
        // После завершения всех мерджей начинаем следующее сползание
        setTimeout(() => {
            this.startAutoSliding();
        }, 100);
    }
    
    findAllMerges() {
        const merges = [];
        const visited = new Set();
        
        // Проверяем только игровые строки (2-7)
        for (let row = 2; row < this.gridHeight; row++) {
            for (let col = 0; col < this.gridWidth; col++) {
                const cellKey = `${row},${col}`;
                if (visited.has(cellKey) || this.grid[row][col] === 0) continue;
                
                const group = this.findConnectedGroup(row, col, this.grid[row][col], visited);
                if (group.length >= 2) {
                    merges.push(group);
                }
            }
        }
        
        return merges;
    }
    
    findConnectedGroup(startRow, startCol, value, visited) {
        const group = [];
        const queue = [{row: startRow, col: startCol}];
        const directions = [[0, 1], [0, -1], [1, 0], [-1, 0]];
        
        while (queue.length > 0) {
            const {row, col} = queue.shift();
            const cellKey = `${row},${col}`;
            
            if (visited.has(cellKey)) continue;
            if (row < 2 || row >= this.gridHeight || col < 0 || col >= this.gridWidth) continue;
            if (this.grid[row][col] !== value) continue;
            
            visited.add(cellKey);
            group.push({row, col, value});
            
            // Добавляем соседей в очередь
            for (const [dr, dc] of directions) {
                const newRow = row + dr;
                const newCol = col + dc;
                const newCellKey = `${newRow},${newCol}`;
                
                if (!visited.has(newCellKey)) {
                    queue.push({row: newRow, col: newCol});
                }
            }
        }
        
        return group;
    }
    
    applyMerges(merges) {
        for (const group of merges) {
            const value = group[0].value;
            const groupSize = group.length;
            
            // Вычисляем новое значение: value * 2^(количество блоков - 1)
            const newValue = value * Math.pow(2, groupSize - 1);
            
            // Находим самую нижнюю позицию в группе для размещения нового блока
            let lowestRow = group[0].row;
            let targetCol = group[0].col;
            
            for (const cell of group) {
                if (cell.row > lowestRow) {
                    lowestRow = cell.row;
                    targetCol = cell.col;
                }
                
                // Очищаем старые блоки
                this.grid[cell.row][cell.col] = 0;
            }
            
            // Размещаем новый блок
            this.grid[lowestRow][targetCol] = newValue;
            
            // Добавляем очки
            const points = newValue * groupSize;
            this.score += points;
            
            // Добавляем анимацию слияния
            this.mergeAnimations.push({
                x: targetCol * this.cellSize + this.padding,
                y: lowestRow * this.cellSize + this.padding,
                value: newValue,
                scale: 0,
                opacity: 1,
                startTime: Date.now()
            });
            
            // Проверяем достижения
            if (newValue >= 256) {
                this.showAchievement(newValue);
            }
            
            // Проверяем цели
            if (newValue >= this.currentGoal) {
                this.achieveGoal(newValue);
            }
            
            this.updateDisplay();
        }
    }
    
    showCombo(comboCount) {
        if (!this.initialGoalShown) return; // Не показываем комбо во время приветственного экрана
        
        const overlay = document.getElementById('game-overlay');
        overlay.innerHTML = `
            <div class="combo-message">
                <h2>КОМБО x${comboCount}!</h2>
                <p>+${comboCount * 50} очков</p>
            </div>
        `;
        overlay.style.pointerEvents = 'none';
        
        // Добавляем бонусные очки за комбо
        this.score += comboCount * 50;
        this.updateDisplay();
        
        setTimeout(() => {
            overlay.innerHTML = '';
        }, 2000);
    }
    
    updateMergeAnimations() {
        const currentTime = Date.now();
        
        this.mergeAnimations = this.mergeAnimations.filter(animation => {
            const elapsed = currentTime - animation.startTime;
            const duration = 500; // 500ms анимация
            
            if (elapsed < duration) {
                const progress = elapsed / duration;
                animation.scale = this.easeOutElastic(progress);
                animation.opacity = 1 - progress * 0.5;
                return true;
            }
            
            return false;
        });
    }
    
    checkDangerousColumns() {
        this.dangerousColumns.clear();
        
        // Проверяем каждый столбец на количество блоков в игровых строках (2-7)
        for (let col = 0; col < this.gridWidth; col++) {
            let blockCount = 0;
            for (let row = 2; row < this.gridHeight; row++) {
                if (this.grid[row][col] !== 0) {
                    blockCount++;
                }
            }
            
            // Если в столбце 5 или больше блоков, он становится опасным
            if (blockCount >= 5) {
                this.dangerousColumns.add(col);
            }
        }
    }
    
    achieveGoal(achievedValue) {
        const nextGoal = this.currentGoal * 2;
        this.currentGoal = nextGoal;
        
        // Обновляем доступные блоки
        this.updateAvailableBlocks();
        
        // Увеличиваем скорость сползания на 1%
        const level = this.getLevelFromGoal(nextGoal);
        this.currentSlidingSpeed = this.baseSlidingSpeed * Math.pow(1.01, level);
        
        this.showGoalAchieved(achievedValue, nextGoal);
    }
    
    getLevelFromGoal(goal) {
        return Math.log2(goal / 512);
    }
    
    updateAvailableBlocks() {
        // При достижении цели 2048 добавляем блок 128 и убираем блок 2
        if (this.currentGoal === 2048) {
            // Убираем блок 2 из доступных
            this.availableBlocks = this.availableBlocks.filter(value => value !== 2);
            // Добавляем блок 128
            if (!this.availableBlocks.includes(128)) {
                this.availableBlocks.push(128);
            }
            // Убираем блоки 2 из очереди и с поля
            this.nextBlocks = this.nextBlocks.filter(value => value !== 2);
            this.removeBlocksFromGrid(2);
        }
        // При достижении цели 4096 добавляем блок 256 и убираем блок 4
        else if (this.currentGoal === 4096) {
            this.availableBlocks = this.availableBlocks.filter(value => value !== 4);
            if (!this.availableBlocks.includes(256)) {
                this.availableBlocks.push(256);
            }
            this.nextBlocks = this.nextBlocks.filter(value => value !== 4);
            this.removeBlocksFromGrid(4);
        }
        // При достижении цели 8192 добавляем блок 512 и убираем блок 8
        else if (this.currentGoal === 8192) {
            this.availableBlocks = this.availableBlocks.filter(value => value !== 8);
            if (!this.availableBlocks.includes(512)) {
                this.availableBlocks.push(512);
            }
            this.nextBlocks = this.nextBlocks.filter(value => value !== 8);
            this.removeBlocksFromGrid(8);
        }
        
        // Пополняем очередь новыми блоками если нужно
        while (this.nextBlocks.length < 3) {
            this.nextBlocks.push(this.generateNextBlockValue());
        }
        
        this.updateNextBlocks();
    }
    
    removeBlocksFromGrid(blockValue) {
        // Убираем все блоки заданного значения с игрового поля
        for (let row = 2; row < this.gridHeight; row++) {
            for (let col = 0; col < this.gridWidth; col++) {
                if (this.grid[row][col] === blockValue) {
                    this.grid[row][col] = 0;
                }
            }
        }
        
        // Применяем гравитацию после удаления
        this.applyGravity();
    }
    
    showGoalAchieved(achievedValue, nextGoal) {
        if (!this.initialGoalShown) return; // Не показываем во время приветственного экрана
        
        const overlay = document.getElementById('game-overlay');
        
        // Определяем какие блоки были убраны
        let removedBlocks = '';
        if (nextGoal === 2048) {
            removedBlocks = ' Блоки "2" убраны с поля.';
        } else if (nextGoal === 4096) {
            removedBlocks = ' Блоки "4" убраны с поля.';
        } else if (nextGoal === 8192) {
            removedBlocks = ' Блоки "8" убраны с поля.';
        }
        
        overlay.innerHTML = `
            <div class="goal-achieved">
                <h2>🎉 ЦЕЛЬ ДОСТИГНУТА!</h2>
                <p>Вы создали блок ${achievedValue}!</p>
                <p>Новая цель: ${nextGoal}</p>
                <p class="removed-info">${removedBlocks}</p>
            </div>
        `;
        overlay.style.pointerEvents = 'none';
        
        setTimeout(() => {
            overlay.innerHTML = '';
        }, 4000);
    }
    
    showInitialGoal() {
        const overlay = document.getElementById('game-overlay');
        overlay.innerHTML = `
            <div class="initial-goal">
                <h1>🎯 ЦЕЛЬ: ${this.currentGoal}</h1>
                <p>Создайте блок со значением ${this.currentGoal} или больше!</p>
                <p>Доступные блоки: ${this.availableBlocks.join(', ')}</p>
                <button class="start-btn" id="start-game">Начать игру</button>
            </div>
        `;
        
        // Делаем оверлей интерактивным для кнопки
        overlay.style.pointerEvents = 'auto';
        
        // Добавляем обработчик для кнопки
        const startBtn = document.getElementById('start-game');
        if (startBtn) {
            startBtn.addEventListener('click', () => {
                overlay.innerHTML = '';
                overlay.style.pointerEvents = 'none';
                this.initialGoalShown = true;
                
                // Начинаем первое автоматическое сползание
                setTimeout(() => {
                    this.startAutoSliding();
                }, 500);
            });
        }
    }
    
    applyGravity() {
        // Применяем гравитацию только к игровым строкам (2-7)
        for (let col = 0; col < this.gridWidth; col++) {
            // Собираем все блоки в столбце (только из игровых строк)
            const blocks = [];
            for (let row = 2; row < this.gridHeight; row++) {
                if (this.grid[row][col] !== 0) {
                    blocks.push(this.grid[row][col]);
                    this.grid[row][col] = 0;
                }
            }
            
            // Размещаем блоки снизу вверх
            let targetRow = this.gridHeight - 1;
            for (let i = blocks.length - 1; i >= 0; i--) {
                if (targetRow >= 2) { // Не размещаем в зонах смерти (строки 0-1)
                    this.grid[targetRow][col] = blocks[i];
                    targetRow--;
                } else {
                    // Если блоки не помещаются, игра окончена
                    this.gameOver();
                    return;
                }
            }
        }
    }
    
    showAchievement(value) {
        if (!this.initialGoalShown) return; // Не показываем во время приветственного экрана
        
        const overlay = document.getElementById('game-overlay');
        overlay.innerHTML = `
            <div class="achievement-message">
                <h2>🎉 Потрясающе!</h2>
                <p>Вы создали большое число ${value}!</p>
                <div class="coin-reward">🪙 +20</div>
            </div>
        `;
        overlay.style.pointerEvents = 'none';
        
        // Добавляем монеты
        this.coins += 20;
        this.updateDisplay();
        
        setTimeout(() => {
            overlay.innerHTML = '';
        }, 3000);
    }
    
    gameOver() {
        this.isGameRunning = false;
        this.isBlockFalling = false;
        this.isSliding = false;
        this.slidingBlock = null;
        this.currentBlock = null;
        
        const overlay = document.getElementById('game-overlay');
        overlay.innerHTML = `
            <div class="game-over">
                <h1>💥 Игра окончена!</h1>
                <p>Финальный счет: <strong>${this.score}</strong></p>
                <p>Лучший результат: <strong>${this.bestScore}</strong></p>
                <button class="start-btn" id="restart-game">Играть снова</button>
            </div>
        `;
        
        overlay.style.pointerEvents = 'auto';
        
        const restartBtn = document.getElementById('restart-game');
        if (restartBtn) {
            restartBtn.addEventListener('click', () => {
                this.restartGame();
            });
        }
        
        // Сохраняем лучший результат
        if (this.score > this.bestScore) {
            this.bestScore = this.score;
            this.saveBestScore();
        }
    }
    
    restartGame() {
        // Сброс всех переменных состояния
        this.grid = this.createEmptyGrid();
        this.currentBlock = null;
        this.nextBlocks = [2, 4, 2];
        this.score = 0;
        this.isGameRunning = true;
        this.isBlockFalling = false;
        
        // Сброс системы комбо
        this.comboCount = 0;
        this.comboMultiplier = 1;
        this.isProcessingMerges = false;
        
        // Сброс системы целей
        this.currentGoal = 512;
        this.availableBlocks = [2, 4, 8, 16, 32, 64];
        this.goalAchieved = false;
        this.initialGoalShown = false;
        
        // Сброс анимаций
        this.mergeAnimations = [];
        this.animationStartTime = 0;
        
        // Сброс предупреждений
        this.dangerousColumns.clear();
        
        // Сброс системы сползания
        this.slidingBlock = null;
        this.currentSlidingSpeed = this.baseSlidingSpeed;
        this.isSliding = false;
        this.lastDropColumn = Math.floor(this.gridWidth / 2);
        this.isPaused = false;
        
        // Очистка интерфейса
        const overlay = document.getElementById('game-overlay');
        overlay.innerHTML = '';
        overlay.style.pointerEvents = 'none';
        
        // Обновление кнопки паузы
        const pauseBtn = document.getElementById('pause-btn');
        if (pauseBtn) {
            pauseBtn.textContent = '⏸️';
        }
        
        this.updateDisplay();
        this.updateNextBlocks();
        
        // Показываем начальную цель
        setTimeout(() => {
            this.showInitialGoal();
        }, 500);
    }
    
    togglePause() {
        this.isPaused = !this.isPaused;
        
        const pauseBtn = document.getElementById('pause-btn');
        const overlay = document.getElementById('game-overlay');
        
        if (this.isPaused) {
            pauseBtn.textContent = '▶️';
            overlay.innerHTML = `
                <div class="pause-screen">
                    <h1>⏸️ Пауза</h1>
                    <p>Нажмите кнопку воспроизведения<br>для продолжения игры</p>
                </div>
            `;
            overlay.style.pointerEvents = 'none';
        } else {
            pauseBtn.textContent = '⏸️';
            overlay.innerHTML = '';
        }
    }
    
    updateSliding() {
        if (!this.isSliding || !this.slidingBlock || this.isPaused) return;
        
        // Увеличиваем прогресс сползания
        this.slidingBlock.progress += this.currentSlidingSpeed;
        
        // Если достигли цели, блок падает
        if (this.slidingBlock.progress >= 1) {
            this.landSlidingBlock();
        }
    }
    
    createEmptyGrid() {
        const grid = [];
        for (let row = 0; row < this.gridHeight; row++) {
            grid[row] = new Array(this.gridWidth).fill(0);
        }
        return grid;
    }
    
    updateDisplay() {
        document.getElementById('current-score').textContent = this.score;
        document.getElementById('best-score').textContent = this.bestScore;
        document.getElementById('coins').textContent = this.coins;
    }
    
    updateNextBlocks() {
        for (let i = 0; i < 3; i++) {
            const blockElement = document.getElementById(`next-${i + 1}`);
            if (blockElement && this.nextBlocks[i]) {
                blockElement.textContent = this.nextBlocks[i];
                blockElement.style.backgroundColor = this.blockColors[this.nextBlocks[i]] || '#666';
            }
        }
    }
    
    loadBestScore() {
        return parseInt(localStorage.getItem('bestScore') || '0');
    }
    
    saveBestScore() {
        localStorage.setItem('bestScore', this.bestScore.toString());
    }
    
    easeOutBounce(t) {
        if (t < 1 / 2.75) {
            return 7.5625 * t * t;
        } else if (t < 2 / 2.75) {
            return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
        } else if (t < 2.5 / 2.75) {
            return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
        } else {
            return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
        }
    }
    
    easeOutElastic(t) {
        const c4 = (2 * Math.PI) / 3;
        return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
    }
    
    easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }
    
    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Рисуем сетку игрового поля (только игровые строки 2-7)
        for (let row = 2; row < this.gridHeight; row++) {
            for (let col = 0; col < this.gridWidth; col++) {
                const x = col * this.cellSize + this.padding;
                const y = (row - 2) * this.cellSize + this.padding; // Смещаем отображение, чтобы строка 2 была первой видимой
                
                // Рисуем фон ячейки
                this.ctx.fillStyle = '#2d3748';
                this.ctx.fillRect(x, y, this.cellSize - 2, this.cellSize - 2);
                
                // Рисуем блок если он есть
                if (this.grid[row][col] !== 0) {
                    const value = this.grid[row][col];
                    this.ctx.fillStyle = this.blockColors[value] || '#666';
                    this.ctx.fillRect(x + 2, y + 2, this.cellSize - 6, this.cellSize - 6);
                    
                    // Рисуем текст
                    this.ctx.fillStyle = 'white';
                    this.ctx.font = 'bold 14px Arial';
                    this.ctx.textAlign = 'center';
                    this.ctx.textBaseline = 'middle';
                    this.ctx.fillText(value, x + this.cellSize / 2, y + this.cellSize / 2);
                }
            }
        }
        
        // Рисуем зону предупреждения (строка 1 = зона смерти)
        if (this.dangerousColumns.size > 0) {
            const warningY = this.padding - this.cellSize;
            const pulseOpacity = 0.3 + 0.2 * Math.sin(Date.now() * 0.01);
            
            // Создаем градиент для всей строки
            const gradient = this.ctx.createLinearGradient(0, warningY, 0, warningY + this.cellSize);
            gradient.addColorStop(0, `rgba(239, 68, 68, ${pulseOpacity})`);
            gradient.addColorStop(1, 'rgba(239, 68, 68, 0)');
            
            this.ctx.fillStyle = gradient;
            this.ctx.fillRect(this.padding, warningY, this.gridWidth * this.cellSize, this.cellSize);
        }
        
        // Рисуем падающий блок
        if (this.currentBlock) {
            const x = this.currentBlock.x * this.cellSize + this.padding;
            const y = (this.currentBlock.y - 2) * this.cellSize + this.padding;
            const value = this.currentBlock.value;
            
            this.ctx.fillStyle = this.blockColors[value] || '#666';
            this.ctx.fillRect(x + 2, y + 2, this.cellSize - 6, this.cellSize - 6);
            
            this.ctx.fillStyle = 'white';
            this.ctx.font = 'bold 14px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(value, x + this.cellSize / 2, y + this.cellSize / 2);
        }
        
        // Рисуем сползающий блок
        if (this.slidingBlock) {
            const startX = this.slidingBlock.x * this.cellSize + this.padding;
            const endX = this.slidingBlock.targetX * this.cellSize + this.padding;
            const currentX = startX + (endX - startX) * this.slidingBlock.progress;
            const y = this.padding - this.cellSize; // Строка сползания
            const value = this.slidingBlock.value;
            
            this.ctx.fillStyle = this.blockColors[value] || '#666';
            this.ctx.fillRect(currentX + 2, y + 2, this.cellSize - 6, this.cellSize - 6);
            
            this.ctx.fillStyle = 'white';
            this.ctx.font = 'bold 14px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(value, currentX + this.cellSize / 2, y + this.cellSize / 2);
        }
        
        // Рисуем анимации слияния
        for (const animation of this.mergeAnimations) {
            this.ctx.save();
            this.ctx.globalAlpha = animation.opacity;
            this.ctx.translate(animation.x + this.cellSize / 2, animation.y + this.cellSize / 2);
            this.ctx.scale(animation.scale, animation.scale);
            
            this.ctx.fillStyle = this.blockColors[animation.value] || '#666';
            this.ctx.fillRect(-this.cellSize / 2 + 2, -this.cellSize / 2 + 2, this.cellSize - 6, this.cellSize - 6);
            
            this.ctx.fillStyle = 'white';
            this.ctx.font = 'bold 14px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(animation.value, 0, 0);
            
            this.ctx.restore();
        }
    }
    
    gameLoop() {
        if (!this.isPaused) {
            this.updateMergeAnimations();
            this.updateSliding();
        }
        this.render();
        requestAnimationFrame(() => this.gameLoop());
    }
}

// Инициализация игры
document.addEventListener('DOMContentLoaded', () => {
    window.game = new BlockMergeGame();
});
