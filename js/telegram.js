class TelegramIntegration {
    constructor() {
        this.tg = window.Telegram?.WebApp;
        this.isInTelegram = !!this.tg;
        
        this.init();
    }
    
    init() {
        if (!this.isInTelegram) {
            console.log('Запущено вне Telegram - используется обычный веб режим');
            return;
        }
        
        // Инициализируем Telegram Web App
        this.tg.ready();
        
        // Настраиваем интерфейс
        this.setupTelegramUI();
        
        // Загружаем данные пользователя
        this.loadUserData();
        
        // Настраиваем обработчики событий
        this.setupEventHandlers();
    }
    
    setupTelegramUI() {
        // Расширяем приложение на весь экран
        this.tg.expand();
        
        // Устанавливаем цвет темы
        this.tg.setHeaderColor('#2c3e50');
        this.tg.setBackgroundColor('#34495e');
        
        // Показываем главную кнопку
        this.tg.MainButton.setText('Поделиться результатом');
        this.tg.MainButton.color = '#3498db';
        this.tg.MainButton.textColor = '#ffffff';
        
        // Скрываем главную кнопку по умолчанию
        this.tg.MainButton.hide();
    }
    
    loadUserData() {
        if (!this.tg.initDataUnsafe?.user) return;
        
        const user = this.tg.initDataUnsafe.user;
        
        // Загружаем сохраненные данные из Telegram Cloud Storage
        this.loadCloudData().then(data => {
            if (data) {
                // Восстанавливаем игровое состояние
                if (data.bestScore && window.game) {
                    window.game.bestScore = data.bestScore;
                    window.game.coins = data.coins || 320;
                    window.game.updateDisplay();
                }
            }
        });
    }
    
    setupEventHandlers() {
        // Обработчик главной кнопки
        this.tg.MainButton.onClick(() => {
            this.shareScore();
        });
        
        // Обработчик закрытия приложения
        this.tg.onEvent('viewportChanged', () => {
            this.saveGameData();
        });
        
        // Сохраняем данные при выходе
        window.addEventListener('beforeunload', () => {
            this.saveGameData();
        });
        
        // Обработчик для кнопки "Назад"
        this.tg.BackButton.onClick(() => {
            this.tg.close();
        });
    }
    
    // Сохранение данных в Telegram Cloud Storage
    async saveGameData() {
        if (!this.isInTelegram || !window.game) return;
        
        const gameData = {
            bestScore: window.game.bestScore,
            coins: window.game.coins,
            timestamp: Date.now()
        };
        
        try {
            await this.saveCloudData(gameData);
            console.log('Данные игры сохранены в Telegram Cloud');
        } catch (error) {
            console.error('Ошибка сохранения в Telegram Cloud:', error);
        }
    }
    
    // Загрузка данных из Telegram Cloud Storage
    async loadCloudData() {
        if (!this.isInTelegram) return null;
        
        return new Promise((resolve) => {
            this.tg.CloudStorage.getItem('gameData', (error, value) => {
                if (error) {
                    console.error('Ошибка загрузки из Telegram Cloud:', error);
                    resolve(null);
                } else {
                    try {
                        const data = value ? JSON.parse(value) : null;
                        resolve(data);
                    } catch (e) {
                        console.error('Ошибка парсинга данных:', e);
                        resolve(null);
                    }
                }
            });
        });
    }
    
    // Сохранение данных в Telegram Cloud Storage
    async saveCloudData(data) {
        if (!this.isInTelegram) return;
        
        return new Promise((resolve, reject) => {
            this.tg.CloudStorage.setItem('gameData', JSON.stringify(data), (error, success) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(success);
                }
            });
        });
    }
    
    // Поделиться результатом
    shareScore() {
        if (!this.isInTelegram || !window.game) return;
        
        const score = window.game.score;
        const bestScore = window.game.bestScore;
        
        const message = `🎮 Block Dropping Merge\n🏆 Мой рекорд: ${bestScore}\n📊 Текущий счет: ${score}\n\nПопробуй побить мой результат!`;
        
        // Отправляем данные в чат
        this.tg.sendData(JSON.stringify({
            action: 'share_score',
            score: score,
            bestScore: bestScore,
            message: message
        }));
        
        // Показываем главную кнопку для повторного шаринга
        this.tg.MainButton.show();
    }
    
    // Показать главную кнопку при достижении
    showShareButton() {
        if (!this.isInTelegram) return;
        
        this.tg.MainButton.show();
        this.tg.HapticFeedback.notificationOccurred('success');
    }
    
    // Вибрация при событиях
    hapticFeedback(type = 'light') {
        if (!this.isInTelegram) return;
        
        switch(type) {
            case 'light':
                this.tg.HapticFeedback.impactOccurred('light');
                break;
            case 'medium':
                this.tg.HapticFeedback.impactOccurred('medium');
                break;
            case 'heavy':
                this.tg.HapticFeedback.impactOccurred('heavy');
                break;
            case 'success':
                this.tg.HapticFeedback.notificationOccurred('success');
                break;
            case 'error':
                this.tg.HapticFeedback.notificationOccurred('error');
                break;
        }
    }
    
    // Закрыть приложение
    close() {
        if (!this.isInTelegram) return;
        
        this.saveGameData().then(() => {
            this.tg.close();
        });
    }
}

// Инициализируем Telegram интеграцию
document.addEventListener('DOMContentLoaded', () => {
    window.telegramApp = new TelegramIntegration();
    
    // Ждем загрузки игры перед интеграцией
    const integrateWithGame = () => {
        if (window.game && window.telegramApp.isInTelegram) {
            // Переопределяем метод показа достижений для добавления haptic feedback
            const originalShowAchievement = window.game.showAchievement;
            window.game.showAchievement = function(value) {
                originalShowAchievement.call(this, value);
                window.telegramApp.hapticFeedback('success');
                window.telegramApp.showShareButton();
            };
            
            // Добавляем haptic feedback для движений
            if (window.game.moveBlock) {
                const originalMoveBlock = window.game.moveBlock;
                window.game.moveBlock = function(direction) {
                    originalMoveBlock.call(this, direction);
                    window.telegramApp.hapticFeedback('light');
                };
            }
            
            if (window.game.landBlock) {
                const originalLandBlock = window.game.landBlock;
                window.game.landBlock = function() {
                    originalLandBlock.call(this);
                    window.telegramApp.hapticFeedback('medium');
                };
            }
            
            // Сохраняем данные при изменении рекорда
            if (window.game.addScore) {
                const originalAddScore = window.game.addScore;
                window.game.addScore = function(points) {
                    const oldBestScore = this.bestScore;
                    originalAddScore.call(this, points);
                    
                    if (this.bestScore > oldBestScore) {
                        window.telegramApp.saveGameData();
                        window.telegramApp.hapticFeedback('success');
                    }
                };
            }
        } else {
            // Повторяем попытку через 100ms если игра еще не загружена
            setTimeout(integrateWithGame, 100);
        }
    };
    
    // Запускаем интеграцию
    setTimeout(integrateWithGame, 100);
});
