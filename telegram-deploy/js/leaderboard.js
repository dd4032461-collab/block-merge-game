class LeaderboardManager {
    constructor() {
        this.isInTelegram = !!(window.Telegram?.WebApp);
        this.tg = window.Telegram?.WebApp;
        this.apiBaseUrl = 'https://api.your-backend.com'; // Замените на ваш backend URL
        
        this.init();
    }
    
    init() {
        this.createLeaderboardUI();
        this.setupEventListeners();
        
        // Загружаем лидерборд при инициализации
        if (this.isInTelegram) {
            this.loadLeaderboard();
        }
    }
    
    createLeaderboardUI() {
        // Создаем HTML для лидерборда
        const leaderboardHTML = `
            <div class="leaderboard-overlay" id="leaderboard-overlay" style="display: none;">
                <div class="leaderboard-modal">
                    <div class="leaderboard-header">
                        <h2>🏆 Таблица лидеров</h2>
                        <button class="close-leaderboard" id="close-leaderboard">✕</button>
                    </div>
                    
                    <div class="leaderboard-tabs">
                        <button class="tab-btn active" data-tab="global">🌍 Глобальный</button>
                        <button class="tab-btn" data-tab="friends">👥 Друзья</button>
                        <button class="tab-btn" data-tab="weekly">📅 Неделя</button>
                    </div>
                    
                    <div class="leaderboard-content">
                        <div class="my-position">
                            <div class="position-card">
                                <span class="my-rank">#-</span>
                                <div class="my-info">
                                    <span class="my-name">Вы</span>
                                    <span class="my-score">0</span>
                                </div>
                                <span class="trophy">🏆</span>
                            </div>
                        </div>
                        
                        <div class="leaders-list" id="leaders-list">
                            <div class="loading">Загрузка...</div>
                        </div>
                    </div>
                    
                    <div class="leaderboard-actions">
                        <button class="share-btn" id="share-score-btn">📤 Поделиться результатом</button>
                        <button class="challenge-btn" id="challenge-friends-btn">⚔️ Вызвать друзей</button>
                    </div>
                </div>
            </div>
        `;
        
        // Добавляем в DOM
        document.body.insertAdjacentHTML('beforeend', leaderboardHTML);
        
        // Добавляем кнопку открытия лидерборда в верхнюю панель
        const socialSection = document.querySelector('.social');
        if (socialSection) {
            const leaderboardBtn = document.createElement('button');
            leaderboardBtn.className = 'leaderboard-btn';
            leaderboardBtn.innerHTML = '🏆';
            leaderboardBtn.title = 'Таблица лидеров';
            leaderboardBtn.addEventListener('click', () => this.showLeaderboard());
            socialSection.appendChild(leaderboardBtn);
        }
    }
    
    setupEventListeners() {
        // Закрытие лидерборда
        document.getElementById('close-leaderboard').addEventListener('click', () => {
            this.hideLeaderboard();
        });
        
        // Переключение табов
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });
        
        // Поделиться результатом
        document.getElementById('share-score-btn').addEventListener('click', () => {
            this.shareScore();
        });
        
        // Вызвать друзей
        document.getElementById('challenge-friends-btn').addEventListener('click', () => {
            this.challengeFriends();
        });
        
        // Закрытие по клику вне модального окна
        document.getElementById('leaderboard-overlay').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                this.hideLeaderboard();
            }
        });
    }
    
    async submitScore(score) {
        if (!this.isInTelegram || !window.game) return;
        
        const user = this.tg.initDataUnsafe?.user;
        if (!user) return;
        
        const scoreData = {
            user_id: user.id,
            username: user.username || `${user.first_name} ${user.last_name || ''}`.trim(),
            first_name: user.first_name,
            score: score,
            timestamp: Date.now(),
            game_data: {
                level: window.game.getLevelFromGoal(window.game.currentGoal),
                coins: window.game.coins,
                current_goal: window.game.currentGoal
            }
        };
        
        try {
            // Здесь отправляем данные на backend
            // Пока что сохраняем локально в Telegram Cloud Storage
            await this.saveScoreToCloud(scoreData);
            console.log('Результат отправлен в лидерборд:', scoreData);
        } catch (error) {
            console.error('Ошибка отправки результата:', error);
        }
    }
    
    async saveScoreToCloud(scoreData) {
        if (!this.isInTelegram) return;
        
        return new Promise((resolve, reject) => {
            const key = `leaderboard_${scoreData.user_id}`;
            this.tg.CloudStorage.setItem(key, JSON.stringify(scoreData), (error, success) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(success);
                }
            });
        });
    }
    
    async loadLeaderboard(type = 'global') {
        const leadersList = document.getElementById('leaders-list');
        leadersList.innerHTML = '<div class="loading">Загрузка...</div>';
        
        try {
            let leaders;
            
            if (this.isInTelegram) {
                // Загружаем из Telegram Cloud Storage (демо)
                leaders = await this.loadDemoLeaderboard();
            } else {
                // Загружаем демо данные для тестирования
                leaders = await this.loadDemoLeaderboard();
            }
            
            this.renderLeaderboard(leaders, type);
            this.updateMyPosition();
        } catch (error) {
            console.error('Ошибка загрузки лидерборда:', error);
            leadersList.innerHTML = '<div class="error">Ошибка загрузки данных</div>';
        }
    }
    
    async loadDemoLeaderboard() {
        // Демо данные для тестирования
        return [
            { rank: 1, username: 'GameMaster2024', score: 15420, avatar: '👑' },
            { rank: 2, username: 'BlockHero', score: 12890, avatar: '🏆' },
            { rank: 3, username: 'MergeKing', score: 11250, avatar: '🥉' },
            { rank: 4, username: 'PuzzlePro', score: 9876, avatar: '⭐' },
            { rank: 5, username: 'CubeChamp', score: 8965, avatar: '🎯' },
            { rank: 6, username: 'NumberNinja', score: 7543, avatar: '🥷' },
            { rank: 7, username: 'BlockBuster', score: 6789, avatar: '💥' },
            { rank: 8, username: 'MergeExpert', score: 5432, avatar: '🧠' },
            { rank: 9, username: 'ScoreHunter', score: 4321, avatar: '🎪' },
            { rank: 10, username: 'TetrisFan', score: 3210, avatar: '🎮' }
        ];
    }
    
    renderLeaderboard(leaders, type) {
        const leadersList = document.getElementById('leaders-list');
        
        const leadersHTML = leaders.map(leader => {
            const rankIcon = this.getRankIcon(leader.rank);
            const isCurrentUser = this.isCurrentUser(leader);
            
            return `
                <div class="leader-item ${isCurrentUser ? 'current-user' : ''}">
                    <div class="rank">
                        <span class="rank-number">#${leader.rank}</span>
                        <span class="rank-icon">${rankIcon}</span>
                    </div>
                    <div class="leader-info">
                        <span class="leader-avatar">${leader.avatar}</span>
                        <div class="leader-details">
                            <span class="leader-name">${leader.username}</span>
                            <span class="leader-score">${leader.score.toLocaleString()} очков</span>
                        </div>
                    </div>
                    ${isCurrentUser ? '<span class="you-badge">ВЫ</span>' : ''}
                </div>
            `;
        }).join('');
        
        leadersList.innerHTML = leadersHTML;
    }
    
    getRankIcon(rank) {
        switch(rank) {
            case 1: return '🥇';
            case 2: return '🥈';
            case 3: return '🥉';
            default: return rank <= 10 ? '🏅' : '👤';
        }
    }
    
    isCurrentUser(leader) {
        if (!this.isInTelegram) return false;
        const user = this.tg.initDataUnsafe?.user;
        return user && (leader.username === user.username || leader.user_id === user.id);
    }
    
    updateMyPosition() {
        if (!window.game) return;
        
        const myScore = window.game.bestScore;
        const myRank = this.calculateMyRank(myScore);
        
        document.querySelector('.my-rank').textContent = `#${myRank}`;
        document.querySelector('.my-score').textContent = `${myScore.toLocaleString()} очков`;
        
        if (this.isInTelegram) {
            const user = this.tg.initDataUnsafe?.user;
            if (user) {
                document.querySelector('.my-name').textContent = user.first_name || 'Вы';
            }
        }
    }
    
    calculateMyRank(myScore) {
        // Простая логика расчета ранга на основе очков
        if (myScore >= 15000) return Math.floor(Math.random() * 5) + 1;
        if (myScore >= 10000) return Math.floor(Math.random() * 10) + 6;
        if (myScore >= 5000) return Math.floor(Math.random() * 20) + 16;
        if (myScore >= 1000) return Math.floor(Math.random() * 50) + 36;
        return Math.floor(Math.random() * 100) + 86;
    }
    
    switchTab(tabType) {
        // Обновляем активный таб
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabType}"]`).classList.add('active');
        
        // Загружаем данные для выбранного таба
        this.loadLeaderboard(tabType);
    }
    
    showLeaderboard() {
        document.getElementById('leaderboard-overlay').style.display = 'flex';
        this.loadLeaderboard();
        
        // Haptic feedback
        if (this.isInTelegram) {
            this.tg.HapticFeedback?.impactOccurred('light');
        }
    }
    
    hideLeaderboard() {
        document.getElementById('leaderboard-overlay').style.display = 'none';
    }
    
    shareScore() {
        if (!this.isInTelegram || !window.game) return;
        
        const score = window.game.bestScore;
        const rank = this.calculateMyRank(score);
        
        const message = `🎮 Block Merge Game\n🏆 Мой рекорд: ${score.toLocaleString()} очков\n📊 Место в рейтинге: #${rank}\n\n💪 Сможешь побить мой результат?`;
        
        this.tg.sendData(JSON.stringify({
            action: 'share_leaderboard',
            score: score,
            rank: rank,
            message: message
        }));
        
        this.hideLeaderboard();
    }
    
    challengeFriends() {
        if (!this.isInTelegram) return;
        
        const message = `🎯 Я вызываю тебя на дуэль в Block Merge!\n\n🏆 Мой рекорд: ${window.game?.bestScore?.toLocaleString() || 0} очков\n\n💪 Думаешь сможешь побить?`;
        
        this.tg.sendData(JSON.stringify({
            action: 'challenge_friends',
            message: message,
            score: window.game?.bestScore || 0
        }));
        
        this.hideLeaderboard();
    }
}

// Инициализируем лидерборд
document.addEventListener('DOMContentLoaded', () => {
    window.leaderboard = new LeaderboardManager();
    
    // Ждем загрузки игры перед интеграцией
    const integrateWithGame = () => {
        if (window.game && window.game.gameOver) {
            const originalGameOver = window.game.gameOver;
            window.game.gameOver = function() {
                originalGameOver.call(this);
                
                // Отправляем результат в лидерборд если это новый рекорд
                if (this.score > 0 && window.leaderboard) {
                    window.leaderboard.submitScore(this.score);
                }
            };
            
            // Отправляем рекорд при достижении нового лучшего результата
            const originalSaveBestScore = window.game.saveBestScore;
            window.game.saveBestScore = function() {
                originalSaveBestScore.call(this);
                
                if (window.leaderboard) {
                    window.leaderboard.submitScore(this.bestScore);
                }
            };
        } else {
            // Повторяем попытку через 100ms если игра еще не загружена
            setTimeout(integrateWithGame, 100);
        }
    };
    
    // Запускаем интеграцию
    setTimeout(integrateWithGame, 100);
});
