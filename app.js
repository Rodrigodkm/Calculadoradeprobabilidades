// app.js

document.addEventListener('DOMContentLoaded', () => {
    // --- Registro do Service Worker (para PWA) ---
    // Garante que o Service Worker seja registrado assim que a página é carregada,
    // permitindo funcionalidades offline e instalação como PWA.
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
                .then(registration => {
                    console.log('Service Worker registrado com sucesso:', registration.scope);
                })
                .catch(error => {
                    console.error('Falha no registro do Service Worker:', error);
                });
        });
    }
    // --- Fim do Registro do Service Worker ---
    // Acessando elementos do DOM
    const team1NameInput = document.getElementById('team1Name');
    const team2NameInput = document.getElementById('team2Name');
    const minutoAtualInput = document.getElementById('minutoAtual');
    const golsTime1Input = document.getElementById('golsTime1');
    const golsTime2Input = document.getElementById('golsTime2');
    const rawStatsText = document.getElementById('rawStatsText');
    const calculateBtn = document.getElementById('calculateBtn');
    const resetBtn = document.getElementById('resetBtn');
    const resultsDisplay = document.getElementById('resultsDisplay');

    // Funções auxiliares para extrair números de pares de strings
    const extractNumber = (statName) => {
        const regex = new RegExp(`${statName}\\s*(\\d+(?:[.,]\\d+)?)`, 'mi');
        const match = rawStatsText.value.match(regex);
        if (match && match.length > 1) {
            let value = parseFloat(match[1].replace(',', '.'));
            return Number.isNaN(value) ? 0 : value;
        }
        return 0;
    };

    const extractPair = (statName) => {
        const regex = new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*\\%?\\s*(?:[\\r\\n]+\\s*|\\s+)?${statName}\\s*(\\d+(?:[.,]\\d+)?)\\s*\\%?`, 'mi');
        const match = rawStatsText.value.match(regex);

        if (match && match.length >= 3) {
            let valA = parseFloat(match[1].replace(',', '.'));
            let valB = parseFloat(match[2].replace(',', '.'));

            valA = Number.isNaN(valA) ? 0 : valA;
            valB = Number.isNaN(valB) ? 0 : valB;

            return [valA, valB];
        }
        return [0, 0];
    };

    // Função para extrair e mapear estatísticas do texto bruto
    const extractAndMapStatisticsFromText = () => {
        const [posseBolaA, posseBolaB] = extractPair('Posse de bola');
        const [chutesA, chutesB] = extractPair('Chutes');
        const [chutesNoAlvoA, chutesNoAlvoB] = extractPair('Chutes no alvo');
        const [chutesParaForaA, chutesParaForaB] = extractPair('Chutes para fora');
        const [ataquesPerigososA, ataquesPerigososB] = extractPair('Ataques perigosos');
        const [escanteiosA, escanteiosB] = extractPair('Escanteios');
        const [penalidadesA, penalidadesB] = extractPair('Penalidades');
        const [cartoesAmarelosA, cartoesAmarelosB] = extractPair('Cartões amarelos');
        const [cartoesVermelhosA, cartoesVermelhosB] = extractPair('Cartões vermelhos');
        const [bolasAereasVencidasA, bolasAereasVencidasB] = extractPair('Bolas aéreas vencidas');
        const [intercepcoesA, intercepcoesB] = extractPair('Intercepções');
        const [desarmesA, desarmesB] = extractPair('Desarmes');
        const [passesA, passesB] = extractPair('Passes');
        const [precisaoPassesA, precisaoPassesB] = extractPair('Precisão dos passes');
        const [foulA, foulB] = extractPair('Faltas'); // Garantindo que as faltas são extraídas

        return {
            posseBolaA, posseBolaB,
            chutesA, chutesB,
            chutesNoAlvoA, chutesNoAlvoB,
            chutesParaForaA, chutesParaForaB,
            ataquesPerigososA, ataquesPerigososB,
            escanteiosA, escanteiosB,
            penalidadesA, penalidadesB,
            cartoesAmarelosA, cartoesAmarelosB,
            cartoesVermelhosA, cartoesVermelhosB,
            bolasAereasVencidasA, bolasAereasVencidasB,
            intercepcoesA, intercepcoesB,
            desarmesA, desarmesB,
            passesA, passesB,
            precisaoPassesA, precisaoPassesB,
            foulA, foulB // Incluindo faltas no retorno
        };
    };

    // Função auxiliar para cálculo de fatorial (usado na Poisson)
    const factorial = (n) => {
        if (n === 0 || n === 1) return 1;
        let res = 1;
        for (let i = 2; i <= n; i++) res *= i;
        return res;
    };

    // Função auxiliar para cálculo de probabilidade Poisson
    const calculatePoissonProb = (lambda, k) => {
        if (k < 0) return 0;
        return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
    };

    // Função auxiliar para calcular probabilidade "Acima de" (Over)
    const calculateOverProb = (lambda, line) => {
        let probUnder = 0;
        for (let i = 0; i < line; i++) {
            probUnder += calculatePoissonProb(lambda, i);
        }
        return (1 - probUnder) * 100;
    };

    // Função auxiliar para calcular probabilidade "Abaixo de" (Under)
    const calculateUnderProb = (lambda, line) => {
        let probUnder = 0;
        for (let i = 0; i < line; i++) {
            probUnder += calculatePoissonProb(lambda, i);
        }
        return probUnder * 100;
    };


    // Função principal para calcular as probabilidades
    function calculateProbabilities() {
        const team1 = team1NameInput.value || 'Time A';
        const team2 = team2NameInput.value || 'Time B';
        const minute = parseFloat(minutoAtualInput.value) || 0;
        const golsA = parseFloat(golsTime1Input.value) || 0;
        const golsB = parseFloat(golsTime2Input.value) || 0;

        const rawStats = extractAndMapStatisticsFromText();

        const currentGoalDifference = golsA - golsB;
        const gameProgress = minute / 90;

        let prob = {}; // Objeto para armazenar todas as probabilidades

        // ** 1X2 e Chance Dupla **
        // Ajuste no xG base e multiplicadores para serem mais conservadores
        // Reduzindo bases e impacto de chutes/ataques
        const xGA_simple = 0.4 + (rawStats.chutesNoAlvoA * 0.04) + (rawStats.ataquesPerigososA * 0.01);
        const xGB_simple = 0.4 + (rawStats.chutesNoAlvoB * 0.04) + (rawStats.ataquesPerigososB * 0.01);

        const adjustedXGA = xGA_simple - (golsA * 0.5);
        const adjustedXGB = xGB_simple - (golsB * 0.5);

        const finalXGA = Math.max(0.1, adjustedXGA);
        const finalXGB = Math.max(0.1, adjustedXGB);

        const outcomeProbabilities = (xa, xb) => {
            const probWinA = 1 / (1 + Math.exp(xb - xa));
            const probDraw = 1 - (probWinA + (1 / (1 + Math.exp(xa - xb))));
            const probWinB = 1 - probWinA - probDraw;

            let pA = Math.max(0, probWinA);
            let pB = Math.max(0, probWinB);
            let pD = Math.max(0, probDraw);

            const sum = pA + pB + pD;
            pA = (pA / sum) * 100;
            pB = (pB / sum) * 100;
            pD = (pD / sum) * 100;

            return { pA, pB, pD };
        };

        let { pA, pB, pD } = outcomeProbabilities(finalXGA, finalXGB);

        // Aplica o ajuste de minutos e gols se o jogo já passou dos 70%
        if (gameProgress > 0.7) {
            const remainingFactor = (1 - (gameProgress - 0.7) * 2);
            pA = pA * remainingFactor;
            pB = pB * remainingFactor;
            pD = pD * remainingFactor;

            if (currentGoalDifference > 0) {
                pA = pA * (1 + (gameProgress - 0.7) * 1);
                pD = pD * (1 - (gameProgress - 0.7) * 0.5);
                pB = pB * (1 - (gameProgress - 0.7) * 0.8);
            } else if (currentGoalDifference < 0) {
                pB = pB * (1 + (gameProgress - 0.7) * 1);
                pD = pD * (1 - (gameProgress - 0.7) * 0.5);
                pA = pA * (1 - (gameProgress - 0.7) * 0.8);
            } else {
                pD = pD * (1 + (gameProgress - 0.7) * 1);
                pA = pA * (1 - (gameProgress - 0.7) * 0.5);
                pB = pB * (1 - (gameProgress - 0.7) * 0.5);
            }
            const sumAfterAdjustment = pA + pB + pD;
            pA = (pA / sumAfterAdjustment) * 100;
            pB = (pB / sumAfterAdjustment) * 100;
            pD = (pD / sumAfterAdjustment) * 100;
        }

        prob[`Vitória ${team1}`] = Math.max(0, Math.min(100, pA));
        prob[`Empate`] = Math.max(0, Math.min(100, pD));
        prob[`Vitória ${team2}`] = Math.max(0, Math.min(100, pB));

        prob[`${team1} ou Empate`] = prob[`Vitória ${team1}`] + prob[`Empate`];
        prob[`${team2} ou Empate`] = prob[`Vitória ${team2}`] + prob[`Empate`];
        prob[`${team1} ou ${team2}`] = prob[`Vitória ${team1}`] + prob[`Vitória ${team2}`];

        // ** Gols no Jogo (Over/Under) **
        const totalXG = finalXGA + finalXGB;

        // Gols Acima de
        [0.5, 1.5, 2.5, 3.5, 4.5, 5.5].forEach(line => { // Expandindo um pouco mais
            prob[`Gols Acima de ${line}`] = Math.max(0, Math.min(100, calculateOverProb(totalXG, line)));
        });

        // Gols Abaixo de
        [0.5, 1.5, 2.5, 3.5, 4.5, 5.5].forEach(line => { // Expandindo um pouco mais
            prob[`Gols Abaixo de ${line}`] = Math.max(0, Math.min(100, calculateUnderProb(totalXG, line)));
        });


        // ** Escanteios **
        // Ajuste no xG base e multiplicadores para escanteios. Base bem menor.
        const escanteioXG = (rawStats.ataquesPerigososA + rawStats.ataquesPerigososB) * 0.02 + 4.0; // Reduzido de 0.05 e 6

        // Range para escanteios a partir de 4 (então começamos em 3.5 para Over)
        const escanteioLines = [3.5, 4.5, 5.5, 6.5, 7.5, 8.5, 9.5, 10.5, 11.5, 12.5, 13.5, 14.5]; // Até 15 escanteios

        // Escanteios Acima de
        escanteioLines.forEach(line => {
            prob[`Escanteios Acima de ${line}`] = Math.max(0, Math.min(100, calculateOverProb(escanteioXG, line)));
        });

        // Escanteios Abaixo de - NOVO!
        escanteioLines.forEach(line => {
            prob[`Escanteios Abaixo de ${line}`] = Math.max(0, Math.min(100, calculateUnderProb(escanteioXG, line)));
        });


        // ** Cartões Amarelos **
        // Ajuste no xG base e multiplicadores para cartões. Usando faltas como principal indicador.
        const cartaoXG = (rawStats.foulA + rawStats.foulB) * 0.03 + 2.0; // Ajustado de 0.05 e 3. Base menor e multiplicador menor

        // Range para cartões amarelos de 3 até 10 (então começamos em 2.5 para Over)
        const cartaoLines = [2.5, 3.5, 4.5, 5.5, 6.5, 7.5, 8.5, 9.5, 10.5]; // Até 10 cartões

        // Cartões Amarelos Acima de
        cartaoLines.forEach(line => {
            prob[`Cartões Amarelos Acima de ${line}`] = Math.max(0, Math.min(100, calculateOverProb(cartaoXG, line)));
        });

        // Cartões Amarelos Abaixo de - NOVO!
        cartaoLines.forEach(line => {
            prob[`Cartões Amarelos Abaixo de ${line}`] = Math.max(0, Math.min(100, calculateUnderProb(cartaoXG, line)));
        });


        // ** Ambos Marcam **
        const probTeamA_score = 1 - calculatePoissonProb(finalXGA, 0);
        const probTeamB_score = 1 - calculatePoissonProb(finalXGB, 0);

        prob[`Ambos Marcam - Sim`] = Math.max(0, Math.min(100, (probTeamA_score * probTeamB_score) * 100));
        prob[`Ambos Marcam - Não`] = 100 - prob[`Ambos Marcam - Sim`];


        // ** Handicap Asiático **
        const handicapValues = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.25, 2.5];
        handicapValues.forEach(h => {
            // Handicap Time A
            let diffFromHandicapA = currentGoalDifference - h;
            let probA_plus_H = 1 / (1 + Math.exp(-diffFromHandicapA * 2));
            probA_plus_H = probA_plus_H * 100;

            if (currentGoalDifference >= 0 && gameProgress > 0.7) {
                probA_plus_H = probA_plus_H * (1 + (gameProgress - 0.7));
            }
            prob[`Handicap Asiático ${team1} +${h}`] = Math.max(0, Math.min(100, probA_plus_H));
            prob[`Handicap Asiático ${team1} -${h}`] = 100 - prob[`Handicap Asiático ${team1} +${h}`];

            // Handicap Time B
            let diffFromHandicapB = -currentGoalDifference - h;
            let probB_minus_H = 1 / (1 + Math.exp(-diffFromHandicapB * 2));
            probB_minus_H = probB_minus_H * 100;

            if (currentGoalDifference < 0 && gameProgress > 0.7) {
                probB_minus_H = probB_minus_H * (1 + (gameProgress - 0.7));
            }
            prob[`Handicap Asiático ${team2} -${h}`] = Math.max(0, Math.min(100, probB_minus_H));
            prob[`Handicap Asiático ${team2} +${h}`] = 100 - prob[`Handicap Asiático ${team2} -${h}`];
        });

        // Arredondamento final de todas as probabilidades e tratamento de NaN
        for (const key in prob) {
            if (typeof prob[key] === 'number' && !Number.isNaN(prob[key])) {
                prob[key] = Math.round(prob[key] * 10) / 10;
            } else {
                prob[key] = 0; // Atribui 0 se for NaN ou não for um número
            }
        }

        return prob;
    }


    // Função para exibir as probabilidades (atualizada para novas categorias)
    function displayProbabilities(probabilities, team1Name, team2Name) {
        resultsDisplay.innerHTML = ''; // Limpa resultados anteriores

        const mainTitle = document.createElement('h3');
        mainTitle.textContent = 'Probabilidades Calculadas:';
        resultsDisplay.appendChild(mainTitle);

        const createCategorySection = (title, keys, currentProbabilities, teamA, teamB) => {
            const categoryDiv = document.createElement('div');
            categoryDiv.classList.add('probability-category');

            const categoryTitle = document.createElement('h4');
            categoryTitle.textContent = title;
            categoryDiv.appendChild(categoryTitle);

            const ul = document.createElement('ul');

            let maxProb = -1;
            let maxProbKey = '';

            const categoryProbs = {};
            keys.forEach(key => {
                let actualKey = key;
                if (actualKey.includes('Time A')) actualKey = actualKey.replace('Time A', teamA);
                if (actualKey.includes('Time B')) actualKey = actualKey.replace('Time B', teamB);

                if (currentProbabilities[actualKey] !== undefined) {
                    categoryProbs[actualKey] = currentProbabilities[actualKey];
                    if (currentProbabilities[actualKey] > maxProb) {
                        maxProb = currentProbabilities[actualKey];
                        maxProbKey = actualKey;
                    }
                }
            });

            const highlightKeys = Object.keys(categoryProbs).filter(key => categoryProbs[key] === maxProb);

            keys.forEach(key => {
                let actualKey = key;
                if (actualKey.includes('Time A')) actualKey = actualKey.replace('Time A', teamA);
                if (actualKey.includes('Time B')) actualKey = actualKey.replace('Time B', teamB);

                if (currentProbabilities[actualKey] !== undefined) {
                    const li = document.createElement('li');
                    li.textContent = `${actualKey}: ${currentProbabilities[actualKey].toFixed(1)}%`;
                    
                    if (highlightKeys.includes(actualKey) && maxProb > 0) {
                        li.classList.add('highlighted-prob');
                    }
                    ul.appendChild(li);
                }
            });
            categoryDiv.appendChild(ul);
            resultsDisplay.appendChild(categoryDiv);
        };

        // Chamadas para criar as seções de cada categoria
        const mainProbKeys = [`Vitória Time A`, `Empate`, `Vitória Time B`, `Time A ou Empate`, `Time B ou Empate`, `Time A ou Time B`];
        createCategorySection('Probabilidades Principais', mainProbKeys, probabilities, team1Name, team2Name);

        const golKeys = [`Gols Acima de 0.5`, `Gols Acima de 1.5`, `Gols Acima de 2.5`, `Gols Acima de 3.5`, `Gols Acima de 4.5`, `Gols Abaixo de 0.5`, `Gols Abaixo de 1.5`, `Gols Abaixo de 2.5`, `Gols Abaixo de 3.5`, `Gols Abaixo de 4.5`]; // Mantendo as mesmas linhas, mas os valores devem estar mais realistas agora
        createCategorySection('Gols no Jogo', golKeys, probabilities, team1Name, team2Name);


        // Escanteios: Expandindo o range
        const escanteioLines = [3.5, 4.5, 5.5, 6.5, 7.5, 8.5, 9.5, 10.5, 11.5, 12.5, 13.5, 14.5];
        const escanteioOverKeys = escanteioLines.map(line => `Escanteios Acima de ${line}`);
        createCategorySection('Escanteios Acima', escanteioOverKeys, probabilities, team1Name, team2Name);

        const escanteioUnderKeys = escanteioLines.map(line => `Escanteios Abaixo de ${line}`);
        createCategorySection('Escanteios Abaixo', escanteioUnderKeys, probabilities, team1Name, team2Name);


        // Cartões Amarelos: Expandindo o range
        const cartaoLines = [2.5, 3.5, 4.5, 5.5, 6.5, 7.5, 8.5, 9.5, 10.5];
        const cartaoAmareloOverKeys = cartaoLines.map(line => `Cartões Amarelos Acima de ${line}`);
        createCategorySection('Cartões Amarelos Acima', cartaoAmareloOverKeys, probabilities, team1Name, team2Name);

        const cartaoAmareloUnderKeys = cartaoLines.map(line => `Cartões Amarelos Abaixo de ${line}`);
        createCategorySection('Cartões Amarelos Abaixo', cartaoAmareloUnderKeys, probabilities, team1Name, team2Name);


        const ambosMarcamKeys = [`Ambos Marcam - Sim`, `Ambos Marcam - Não`];
        createCategorySection('Ambos Marcam', ambosMarcamKeys, probabilities, team1Name, team2Name);

        const handicapKeys = [
            `Handicap Asiático ${team1Name} -0.25`, `Handicap Asiático ${team1Name} +0.25`,
            `Handicap Asiático ${team2Name} -0.25`, `Handicap Asiático ${team2Name} +0.25`,
            `Handicap Asiático ${team1Name} -0.5`, `Handicap Asiático ${team1Name} +0.5`,
            `Handicap Asiático ${team2Name} -0.5`, `Handicap Asiático ${team2Name} +0.5`,
            `Handicap Asiático ${team1Name} -0.75`, `Handicap Asiático ${team1Name} +0.75`,
            `Handicap Asiático ${team2Name} -0.75`, `Handicap Asiático ${team2Name} +0.75`,
            `Handicap Asiático ${team1Name} -1.0`, `Handicap Asiático ${team1Name} +1.0`,
            `Handicap Asiático ${team2Name} -1.0`, `Handicap Asiático ${team2Name} +1.0`,
            `Handicap Asiático ${team1Name} -1.25`, `Handicap Asiático ${team1Name} +1.25`,
            `Handicap Asiático ${team2Name} -1.25`, `Handicap Asiático ${team2Name} +1.25`,
            `Handicap Asiático ${team1Name} -1.5`, `Handicap Asiático ${team1Name} +1.5`,
            `Handicap Asiático ${team2Name} -1.5`, `Handicap Asiático ${team2Name} +1.5`,
            `Handicap Asiático ${team1Name} -1.75`, `Handicap Asiático ${team1Name} +1.75`,
            `Handicap Asiático ${team2Name} -1.75`, `Handicap Asiático ${team2Name} +1.75`,
            `Handicap Asiático ${team1Name} -2.0`, `Handicap Asiático ${team1Name} +2.0`,
            `Handicap Asiático ${team2Name} -2.0`, `Handicap Asiático ${team2Name} +2.0`,
            `Handicap Asiático ${team1Name} -2.25`, `Handicap Asiático ${team1Name} +2.25`,
            `Handicap Asiático ${team2Name} -2.25`, `Handicap Asiático ${team2Name} +2.25`,
            `Handicap Asiático ${team1Name} -2.5`, `Handicap Asiático ${team1Name} +2.5`,
            `Handicap Asiático ${team2Name} -2.5`, `Handicap Asiático ${team2Name} +2.5`
        ];
        createCategorySection('Handicap Asiático', handicapKeys, probabilities, team1Name, team2Name);
    }


    // Adiciona os event listeners
    calculateBtn.addEventListener('click', () => {
        const team1 = team1NameInput.value || 'Time A';
        const team2 = team2NameInput.value || 'Time B';
        const probabilities = calculateProbabilities();
        displayProbabilities(probabilities, team1, team2);
    });

    resetBtn.addEventListener('click', () => {
        team1NameInput.value = 'Time A';
        team2NameInput.value = 'Time B';
        minutoAtualInput.value = '45';
        golsTime1Input.value = '0';
        golsTime2Input.value = '0';
        rawStatsText.value = '';
        resultsDisplay.innerHTML = '';
    });
});