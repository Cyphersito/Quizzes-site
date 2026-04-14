const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// ¡AQUÍ ESTÁ LA MAGIA! 
// Importamos el archivo JSON directamente. Node.js lo convierte en un arreglo de JavaScript automáticamente.
const quizData = require('./preguntas.json');

// Estado del juego
let gameState = {
    players: {},
    currentQuestion: 0,
    isGameStarted: false,
    questionStartTime: 0
};

let timerInterval;

io.on('connection', (socket) => {
    console.log(`Un usuario se ha conectado: ${socket.id}`);

    // Unirse al juego
    socket.on('joinGame', (username) => {
        gameState.players[socket.id] = { name: username, score: 0, hasAnswered: false };
        io.emit('updatePlayerList', Object.values(gameState.players));
    });

    // Iniciar el juego
    socket.on('startGame', () => {
        if (!gameState.isGameStarted) {
            gameState.isGameStarted = true;
            sendQuestion(0, io);
        }
    });

    // Recibir respuesta
    socket.on('submitAnswer', (answerIndex) => {
        const player = gameState.players[socket.id];
        const question = quizData[gameState.currentQuestion];

        if (player && !player.hasAnswered) {
            player.hasAnswered = true;

            if (answerIndex === question.correct) {
                const timeTaken = (Date.now() - gameState.questionStartTime) / 1000;
                let points = Math.round(1000 * (1 - (timeTaken / 20)));
                
                if (points < 500) points = 500;
                
                player.score += points; 
            }
        }
    });

    // Desconexión
    socket.on('disconnect', () => {
        delete gameState.players[socket.id];
        io.emit('updatePlayerList', Object.values(gameState.players));
    });
});

// Función para enviar una pregunta
function sendQuestion(index, io) {
    if (index < quizData.length) {
        gameState.currentQuestion = index;
        let timeLeft = 20; 

        clearInterval(timerInterval); 
        gameState.questionStartTime = Date.now();

        for (let id in gameState.players) {
            gameState.players[id].hasAnswered = false;
        }

        io.emit('newQuestion', {
            text: quizData[index].question,
            options: quizData[index].options,
            duration: timeLeft
        });

        timerInterval = setInterval(() => {
            timeLeft--;
            io.emit('timerUpdate', timeLeft);

            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                finishQuestion(io);
            }
        }, 1000);
    } else {
        io.emit('gameOver', Object.values(gameState.players).sort((a, b) => b.score - a.score));
        gameState.isGameStarted = false; 
    }
}

// Función para terminar la pregunta
function finishQuestion(io) {
    const correctAnswer = quizData[gameState.currentQuestion].correct;
    io.emit('questionFinished', correctAnswer);
    
    setTimeout(() => {
        sendQuestion(gameState.currentQuestion + 1, io);
    }, 4000); 
}

server.listen(3000, () => console.log('Servidor corriendo en http://localhost:3000'));