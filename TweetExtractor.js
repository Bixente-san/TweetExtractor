async function extractTweetDetails(tweetElement, index) {
    if (!tweetElement) return null;
    
    try {
        const searchPageUrl = window.location.href;
        
        const rect = tweetElement.getBoundingClientRect();
        window.scrollTo(0, window.scrollY + rect.top - 100);
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const clickableElement = tweetElement.querySelector('div[data-testid="tweet"]') || tweetElement;
        await clickableElement.click();
        
        await new Promise(resolve => setTimeout(resolve, 800));
        
        const timestampElement = document.querySelector('time');
        const timestamp = timestampElement ? timestampElement.getAttribute('datetime') : null;
        const displayTime = timestamp ? new Date(timestamp).toLocaleString('fr-FR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        }).replace(',', '') : null;
        
        const textContainer = document.querySelector('[data-testid="tweetText"]');
        let tweetText = null;
        if (textContainer) {
            const textNodes = Array.from(textContainer.querySelectorAll('*'))
                .filter(node => node.textContent.trim())
                .map(node => node.textContent.trim());
            
            tweetText = textNodes.length > 0 ? 
                textNodes.join(' ').replace(/\s+/g, ' ').trim() : 
                textContainer.innerText.trim();
        }
        
        if (window.location.href !== searchPageUrl) {
            window.history.back();
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        return {
            text: tweetText,
            timestamp: timestamp,
            displayTime: displayTime,
            index: index
        };
    } catch (error) {
        console.error("Erreur lors de l'extraction des détails du tweet:", error);
        return null;
    }
}

async function smoothScroll() {
    return new Promise(resolve => {
        const scrollDistance = 500;
        const duration = 500;
        const start = window.scrollY;
        const startTime = performance.now();

        function animate(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            window.scrollTo(0, start + (scrollDistance * progress));
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                setTimeout(resolve, 500);
            }
        }

        requestAnimationFrame(animate);
    });
}

async function collectTweetsWithTimestamps(maxTweets, updateProgress) {
    const tweetDetails = [];
    let lastProcessedIndex = -1;
    const processedTweets = new Set();

    while (tweetDetails.length < maxTweets) {
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const tweetElements = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
        
        let foundNewTweet = false;
        for (let i = lastProcessedIndex + 1; i < tweetElements.length; i++) {
            const tweetElement = tweetElements[i];
            const tweetId = tweetElement.innerText.slice(0, 100);
            if (processedTweets.has(tweetId)) continue;
            
            const details = await extractTweetDetails(tweetElement, i);
            if (details && details.text && details.timestamp) {
                tweetDetails.push(details);
                processedTweets.add(tweetId);
                lastProcessedIndex = i;
                foundNewTweet = true;
                updateProgress((tweetDetails.length / maxTweets) * 100);
                break;
            }
        }
        
        if (!foundNewTweet) {
            await smoothScroll();
            if (lastProcessedIndex >= tweetElements.length - 1) {
                lastProcessedIndex = -1;
            }
        }
        
        if (tweetDetails.length >= maxTweets) break;
    }

    return tweetDetails;
}

function getCurrentDateFormatted() {
    const now = new Date();
    return now.toLocaleDateString('fr-FR');
}

function createInterface() {
    const existingUI = document.getElementById('tweetCollector');
    if (existingUI) existingUI.remove();

    const container = document.createElement('div');
    container.id = 'tweetCollector';
    container.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: white;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        z-index: 10000;
        width: 300px;
        font-family: Arial, sans-serif;
        color: black;
    `;

    container.innerHTML = `
        <h2 style="margin: 0 0 15px 0; font-size: 18px;">Collecteur de Tweets</h2>
        <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px;">Nombre de tweets à collecter:</label>
            <input type="number" id="tweetCount" value="5" min="1" max="50" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
        </div>
        <div id="progressContainer" style="display: none; margin-bottom: 15px;">
            <div style="width: 100%; height: 10px; background: #eee; border-radius: 5px; overflow: hidden;">
                <div id="progressBar" style="width: 0%; height: 100%; background: #2196F3; transition: width 0.3s;"></div>
            </div>
            <p id="progressText" style="margin: 5px 0 0 0; font-size: 14px;">0%</p>
        </div>
        <button id="startButton" style="width: 100%; padding: 10px; background: #2196F3; color: white; border: none; border-radius: 4px; cursor: pointer; margin-bottom: 15px;">
            Démarrer la collecte
        </button>
        <div id="tweetList" style="max-height: 300px; overflow-y: auto; margin-bottom: 15px;"></div>
        <div id="exportButtons" style="display: none; justify-content: space-between;">
            <button id="downloadCSV" style="flex: 1; padding: 8px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; margin-right: 5px;">
                Exporter CSV
            </button>
            <button id="copyClipboard" style="flex: 1; padding: 8px; background: #9C27B0; color: white; border: none; border-radius: 4px; cursor: pointer; margin-left: 5px;">
                Copier
            </button>
        </div>
    `;

    document.body.appendChild(container);

    let collectedTweets = [];
    let isCollecting = false;

    function downloadCSV() {
        const headers = ['Texte', 'Date d\'extraction', 'Date/Heure Publication'];
        const currentDate = getCurrentDateFormatted();
        const rows = collectedTweets.map(tweet => [
            `"${tweet.text.replace(/"/g, '""')}"`,
            currentDate,
            tweet.displayTime
        ]);
        
        const csvContent = [
            headers.join(';'),
            ...rows.map(row => row.join(';'))
        ].join('\n');
        
        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `tweets_${new Date().toISOString().slice(0,10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    async function copyToClipboard() {
        const currentDate = getCurrentDateFormatted();
        const formattedContent = collectedTweets.map(tweet => 
            `"${tweet.text}";${currentDate};${tweet.displayTime}`
        ).join('\n');
        
        try {
            await navigator.clipboard.writeText(formattedContent);
            alert('Tweets copiés dans le presse-papier !');
        } catch (err) {
            console.error('Erreur lors de la copie :', err);
        }
    }

    document.getElementById('startButton').addEventListener('click', async () => {
        if (isCollecting) return;
        
        isCollecting = true;
        const count = parseInt(document.getElementById('tweetCount').value);
        document.getElementById('progressContainer').style.display = 'block';
        document.getElementById('startButton').disabled = true;
        document.getElementById('tweetList').innerHTML = '';
        document.getElementById('exportButtons').style.display = 'none';
        
        collectedTweets = await collectTweetsWithTimestamps(count, (progress) => {
            document.getElementById('progressBar').style.width = `${progress}%`;
            document.getElementById('progressText').textContent = `${Math.round(progress)}%`;
        });

        const tweetList = document.getElementById('tweetList');
        collectedTweets.forEach(tweet => {
            const tweetElement = document.createElement('div');
            tweetElement.style.cssText = 'padding: 10px; background: #f5f5f5; margin-bottom: 10px; border-radius: 4px;';
            tweetElement.innerHTML = `
                <p style="margin: 0 0 5px 0; font-size: 14px;">${tweet.text}</p>
                <p style="margin: 0; font-size: 12px; color: #666;">
                    ${tweet.displayTime}
                </p>
            `;
            tweetList.appendChild(tweetElement);
        });

        if (collectedTweets.length > 0) {
            document.getElementById('exportButtons').style.display = 'flex';
        }
        document.getElementById('startButton').disabled = false;
        isCollecting = false;
    });

    document.getElementById('downloadCSV').addEventListener('click', downloadCSV);
    document.getElementById('copyClipboard').addEventListener('click', copyToClipboard);
}

// Lancer l'interface
createInterface();