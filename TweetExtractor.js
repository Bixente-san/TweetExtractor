async function extractTweetDetails(tweetElement, index, speed) {
    if (!tweetElement) return null;
    
    try {
        const searchPageUrl = window.location.href;
        
        const rect = tweetElement.getBoundingClientRect();
        window.scrollTo(0, window.scrollY + rect.top - 100);
        await new Promise(resolve => setTimeout(resolve, speed));
        
        const clickableElement = tweetElement.querySelector('div[data-testid="tweet"]') || tweetElement;
        await clickableElement.click();
        
        await new Promise(resolve => setTimeout(resolve, speed * 1.6));
        
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
            await new Promise(resolve => setTimeout(resolve, speed * 2));
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

async function smoothScroll(speed) {
    return new Promise(resolve => {
        const scrollDistance = 500;
        const duration = speed * 5;
        const start = window.scrollY;
        const startTime = performance.now();

        function animate(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            window.scrollTo(0, start + (scrollDistance * progress));
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                setTimeout(resolve, speed);
            }
        }

        requestAnimationFrame(animate);
    });
}

async function collectTweetsWithTimestamps(maxTweets, updateProgress, speed) {
    const tweetDetails = [];
    let lastProcessedIndex = -1;
    const processedTweets = new Set();

    while (tweetDetails.length < maxTweets) {
        await new Promise(resolve => setTimeout(resolve, speed));
        
        const tweetElements = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
        
        let foundNewTweet = false;
        for (let i = lastProcessedIndex + 1; i < tweetElements.length; i++) {
            const tweetElement = tweetElements[i];
            const tweetId = tweetElement.innerText.slice(0, 100);
            if (processedTweets.has(tweetId)) continue;
            
            const details = await extractTweetDetails(tweetElement, i, speed);
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
            await smoothScroll(speed);
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

function processWordsFromTweets(tweets) {
    const stopWords = new Set([
        'le', 'la', 'les', 'un', 'une', 'des', 'du', 'au', 'aux',
        'à', 'de', 'dans', 'en', 'sur', 'pour', 'par', 'vers', 'entre', 'avec', 'sans',
        'je', 'tu', 'il', 'elle', 'on', 'nous', 'vous', 'ils', 'elles',
        'me', 'te', 'se', 'mon', 'ton', 'son', 'notre', 'votre', 'leur',
        'mes', 'tes', 'ses', 'nos', 'vos', 'leurs',
        'ce', 'cet', 'cette', 'ces', 'celui', 'celle', 'ceux', 'celles', 'cela',
        'et', 'ou', 'mais', 'donc', 'car', 'ni', 'or',
        'plus', 'très', 'bien', 'tout', 'tous', 'toute', 'toutes',
        'est', 'sont', 'fait', 'être', 'suis', 'sera', 'seront',
        'que', 'qui', 'quoi', 'dont', 'où', 'quand', 'comment',
        "d'un", "d'une", "l'on", "c'est", "n'est", "qu'il", "qu'un", "j'ai",
        "l'ensemble", "jusqu'à", "d'entre",
        'ne', 'pas', 'plus', 'jamais', 'rien'
    ]);

    const words = tweets
        .map(tweet => tweet.text.toLowerCase())
        .join(' ')
        .replace(/[.,\/#!$%\^&\*;:{}'=\-_`~()]/g, '')
        .split(/\s+/)
        .filter(word => 
            word.length > 3 && 
            !stopWords.has(word) &&
            !word.startsWith('@') && 
            !word.startsWith('http') &&
            !word.startsWith('#')
        );

    const wordCount = {};
    words.forEach(word => {
        wordCount[word] = (wordCount[word] || 0) + 1;
    });

    return Object.entries(wordCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 50);
}

function createWordCloud(words) {
    if (!words || words.length === 0) return '';
    
    const maxCount = Math.max(...words.map(w => w[1]));
    const minSize = 12;
    const maxSize = 36;

    return `<div style="text-align: center; line-height: 2.5;">` +
        words.map(([word, count]) => {
            const size = minSize + (count / maxCount) * (maxSize - minSize);
            const hue = Math.random() * 360;
            return `<span style="
                font-size: ${size}px;
                padding: 5px;
                display: inline-block;
                color: hsl(${hue}, 70%, 50%);
                cursor: pointer;
                transition: transform 0.2s;
            " onmouseover="this.style.transform='scale(1.1)'"
              onmouseout="this.style.transform='scale(1)'"
              title="${count} occurrences">${word}</span>`;
        }).join('') +
    `</div>`;
}

async function summarizeWithGrok(tweets) {
    // Create the prompt
    const prompt = `Analysez cette collection de tweets et produisez un résumé concis de 280 caractères maximum en français qui : 1. Exprime la moyenne des sentiments (positif/négatif/neutre) 2. Capture les idées récurrentes et thématiques principales 3. Présente un équilibre entre opinions contradictoires le cas échéant 4. Met en avant les éléments marquants partagés par plusieurs tweets\n\n${tweets.map(t => t.text).join('\n\n')}`;
    
    // Copy prompt to clipboard
    await navigator.clipboard.writeText(prompt);
    
    // Show instructions first
    alert("Le texte a été copié dans votre presse-papiers. Une fois que vous cliquerez sur OK, une nouvelle fenêtre s'ouvrira avec Grok. Vous pourrez y coller le texte (Ctrl+V).");
    
    // Then open Grok in a new window
    const grokWindow = window.open('https://x.com/i/grok', '_blank');
    
    if (!grokWindow) {
        alert("Votre navigateur a bloqué l'ouverture de la nouvelle fenêtre. Veuillez autoriser les pop-ups pour ce site.");
    }
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
        max-height: 80vh;
        overflow-y: auto;
        cursor: move;
    `;

    // [Previous HTML content remains the same until the summarize button]
    container.innerHTML = `
    <h2 style="margin: 0 0 15px 0; font-size: 18px;">TweetExtractor</h2>
    <div style="border-bottom: 1px solid #ccc; margin-bottom: 15px; display: flex;">
        <button id="listTab" class="tab active" style="flex: 1; padding: 8px; background: none; border: none; border-bottom: 2px solid #2196F3; cursor: pointer;">Collecteur</button>
        <button id="cloudTab" class="tab" style="flex: 1; padding: 8px; background: none; border: none; cursor: pointer;">Nuage de mots</button>
    </div>
    <div id="listView">
        <div style="margin-bottom: 15px; background: #f5f5f5; padding: 10px; border-radius: 4px;">
            <details>
                <summary style="cursor: pointer; font-weight: bold; color: #2196F3;">Comment faire une recherche avancée sur X ?</summary>
                <div style="margin-top: 10px; font-size: 14px;">
                    <p style="margin: 5px 0;">À partir de la page "Explorer", suivez ces étapes :</p>
                    <ul style="margin: 5px 0 10px 20px;">
                        <li><strong>Tapez votre requête</strong> : Entrez le texte que vous souhaitez rechercher dans la barre de recherche puis cliquez sur entrée, ou cliquez directement sur un mots en tendance, vous verrez les résultats.</li>
                        <li><strong>Cliquez sur "Recherche avancée"</strong> : En haut à droite de votre page de résultats, cliquez sur les trois points (...) puis "Recherche avancée".</li>
                    </ul>
                    <p style="margin: 5px 0;"><strong>Options de recherche disponibles :</strong></p>
                    <ul style="margin: 5px 0 10px 20px;">
                        <li>Recherche par mots ou phrases spécifiques</li>
                        <li>Filtrage par langue ou localisation</li>
                        <li>Sélection d'une période de temps précise</li>
                        <li>Filtrage par compte ou mentions</li>
                        <li>Recherche de tweets avec média (images, vidéos)</li>
                        <li>Filtrage par niveau d'engagement (nombre de likes, retweets)</li>
                    </ul>
                </div>
            </details>
        </div>
        // Continuation of createInterface function
        <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px;">Nombre de tweets à collecter:</label>
            <input type="number" id="tweetCount" value="5" min="1" max="50" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
        </div>
        <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px;">Vitesse de collecte (ms):</label>
            <input type="range" id="collectionSpeed" min="100" max="2000" value="500" style="width: 100%;">
            <span id="speedValue" style="display: block; text-align: center;">500ms</span>
            <p style="margin: 5px 0 0 0; font-size: 12px; color: #FF8C00;">
                ⚠️ Note : Une vitesse de collecte trop basse peut affecter les performances du programme
            </p>
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
        <div style="position: relative; margin-top: 15px;">
            <button id="summarizeButton" style="width: 100%; padding: 10px; background: #FF9800; color: white; border: none; border-radius: 4px; cursor: pointer; display: none;">
                Résumer avec Grok
            </button>
            <div style="position: absolute; right: -25px; top: 50%; transform: translateY(-50%); display: inline-block;">
                <span style="cursor: help; color: #666; font-size: 16px; padding: 5px;" 
                      title="Cette action va ouvrir Grok dans un nouvel onglet et copier les tweets dans votre presse-papiers.">ⓘ</span>
            </div>
        </div>
    </div>
    <div id="cloudView" style="display: none; max-height: 500px; overflow-y: auto;">
    </div>
    `;

    document.body.appendChild(container);

    let collectedTweets = [];
    let isCollecting = false;

    // Gestion des onglets
    document.getElementById('listTab').addEventListener('click', () => {
        document.getElementById('listView').style.display = 'block';
        document.getElementById('cloudView').style.display = 'none';
        document.getElementById('listTab').style.borderBottom = '2px solid #2196F3';
        document.getElementById('cloudTab').style.borderBottom = 'none';
    });

    document.getElementById('cloudTab').addEventListener('click', () => {
        document.getElementById('listView').style.display = 'none';
        document.getElementById('cloudView').style.display = 'block';
        document.getElementById('cloudTab').style.borderBottom = '2px solid #2196F3';
        document.getElementById('listTab').style.borderBottom = 'none';
    });

    // Ajout de la fonctionnalité de glisser-déposer
    let isDragging = false;
    let offsetX, offsetY;

    container.addEventListener('mousedown', (e) => {
        if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'BUTTON' && e.target.tagName !== 'A') {
            isDragging = true;
            offsetX = e.clientX - container.getBoundingClientRect().left;
            offsetY = e.clientY - container.getBoundingClientRect().top;
            container.style.cursor = 'grabbing';
        }
    });

    document.addEventListener('mousemove', (e) => {
        if (isDragging) {
            const x = e.clientX - offsetX;
            const y = e.clientY - offsetY;
            
            // Limites de l'écran
            const maxX = window.innerWidth - container.offsetWidth;
            const maxY = window.innerHeight - container.offsetHeight;
            
            container.style.left = `${Math.min(Math.max(x, 0), maxX)}px`;
            container.style.top = `${Math.min(Math.max(y, 0), maxY)}px`;
        }
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
        container.style.cursor = 'move';
    });

    const speedSlider = document.getElementById('collectionSpeed');
    const speedValue = document.getElementById('speedValue');
    speedSlider.addEventListener('input', function() {
        speedValue.textContent = `${this.value}ms`;
    });

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
        const speed = parseInt(speedSlider.value);
        document.getElementById('progressContainer').style.display = 'block';
        document.getElementById('startButton').disabled = true;
        document.getElementById('tweetList').innerHTML = '';
        document.getElementById('exportButtons').style.display = 'none';
        document.getElementById('summarizeButton').style.display = 'none';
        document.getElementById('cloudView').innerHTML = '';
        
        collectedTweets = await collectTweetsWithTimestamps(count, (progress) => {
            document.getElementById('progressBar').style.width = `${progress}%`;
            document.getElementById('progressText').textContent = `${Math.round(progress)}%`;
        }, speed);

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

        // Créer le nuage de mots
        const cloudView = document.getElementById('cloudView');
        const wordCloudData = processWordsFromTweets(collectedTweets);
        cloudView.innerHTML = createWordCloud(wordCloudData);

        if (collectedTweets.length > 0) {
            document.getElementById('exportButtons').style.display = 'flex';
            document.getElementById('summarizeButton').style.display = 'block';
        }
        
        document.getElementById('startButton').disabled = false;
        isCollecting = false;
    });

    document.getElementById('downloadCSV').addEventListener('click', downloadCSV);
    document.getElementById('copyClipboard').addEventListener('click', copyToClipboard);
    
    // Event listener pour le bouton de résumé avec Grok
    document.getElementById('summarizeButton').addEventListener('click', async () => {
        const button = document.getElementById('summarizeButton');
        button.disabled = true;
        button.textContent = 'Ouverture de Grok...';
        
        try {
            await summarizeWithGrok(collectedTweets);
        } catch (error) {
            console.error('Erreur lors de la génération du résumé:', error);
            alert('Une erreur est survenue lors de la génération du résumé. Veuillez réessayer.');
        } finally {
            button.disabled = false;
            button.textContent = 'Résumer avec Grok';
        }
    });
}

// Lancer l'interface
createInterface();
