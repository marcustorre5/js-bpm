/* global SpotifyWebApi */
/*
  O código para descobrir o BPM / tempo foi retirado deste post:
  http://tech.beatport.com/2014/web-audio/beat-detection-using-web-audio/
 */

'use strict';

var spotifyApi = new SpotifyWebApi();
spotifyApi.getToken().then(function(response) {
  spotifyApi.setAccessToken(response.token);
});

var queryInput = document.querySelector('#query'),
    result = document.querySelector('#result'),
    text = document.querySelector('#text'),
    audioTag = document.querySelector('#audio'),
    playButton = document.querySelector('#play');

function updateProgressState() {
  if (audioTag.paused) {
    return;
  }
  var progressIndicator = document.querySelector('#progress');
  if (progressIndicator && audioTag.duration) {
    progressIndicator.setAttribute('x', (audioTag.currentTime * 100 / audioTag.duration) + '%');
  }
  requestAnimationFrame(updateProgressState);
}

audioTag.addEventListener('play', updateProgressState);
audioTag.addEventListener('playing', updateProgressState);

function updatePlayLabel() {
  playButton.innerHTML = audioTag.paused ? 'Play track' : 'Pause track';
}

audioTag.addEventListener('play', updatePlayLabel);
audioTag.addEventListener('playing', updatePlayLabel);
audioTag.addEventListener('pause', updatePlayLabel);
audioTag.addEventListener('ended', updatePlayLabel);

playButton.addEventListener('click', function() {
  if (audioTag.paused) {
    audioTag.play();
  } else {
    audioTag.pause();
  }
});

result.style.display = 'none';

function getPeaks(data) {

  // O que vamos fazer aqui é dividir nosso áudio em partes.

  // Em seguida, identificaremos, para cada parte, qual é a amostra mais alta naquele
  // papel.

  // Está implícito que essa amostra representaria a 'batida' mais provável
  // dentro dessa parte.

  // Cada parte tem 0,5 segundos de duração - ou 22.050 amostras.

  // Isso nos dará 60 'batidas' - vamos pegar apenas a metade mais alta de
  // Essa.

  // Isso nos permitirá ignorar as pausas e nos permitirá abordar as faixas com
  // um BPM abaixo de 120.

  var partSize = 22050,
      parts = data[0].length / partSize,
      peaks = [];

  for (var i = 0; i < parts; i++) {
    var max = 0;
    for (var j = i * partSize; j < (i + 1) * partSize; j++) {
      var volume = Math.max(Math.abs(data[0][j]), Math.abs(data[1][j]));
      if (!max || (volume > max.volume)) {
        max = {
          position: j,
          volume: volume
        };
      }
    }
    peaks.push(max);
  }

  // Em seguida, classificamos os picos de acordo com o volume ...

  peaks.sort(function(a, b) {
    return b.volume - a.volume;
  });

  // ... pegue a metade mais solta ...

  peaks = peaks.splice(0, peaks.length * 0.5);

  // ... e reorganize-o de volta com base na posição.

  peaks.sort(function(a, b) {
    return a.position - b.position;
  });

  return peaks;
}

function getIntervals(peaks) {

  // O que fazemos agora é obter todos os nossos picos e, em seguida, medir a distância para
  // outros picos, para criar intervalos. Então, com base na distância entre
  // esses picos (a distância dos intervalos), podemos calcular o BPM de
  // esse intervalo particular.

  // O intervalo mais visto deve ter o BPM que corresponde
  // para a própria pista.

  var groups = [];

  peaks.forEach(function(peak, index) {
    for (var i = 1; (index + i) < peaks.length && i < 10; i++) {
      var group = {
        tempo: (60 * 44100) / (peaks[index + i].position - peak.position),
        count: 1
      };

      while (group.tempo < 90) {
        group.tempo *= 2;
      }

      while (group.tempo > 180) {
        group.tempo /= 2;
      }

      group.tempo = Math.round(group.tempo);

      if (!(groups.some(function(interval) {
        return (interval.tempo === group.tempo ? interval.count++ : 0);
      }))) {
        groups.push(group);
      }
    }
  });
  return groups;
}

document.querySelector('form').addEventListener('submit', function(formEvent) {
  formEvent.preventDefault();
  result.style.display = 'none';
  spotifyApi.searchTracks(
    queryInput.value.trim(), {limit: 1})
    .then(function(results) {
      var track = results.tracks.items[0];
      var previewUrl = track.preview_url;
      audioTag.src = track.preview_url;

      var request = new XMLHttpRequest();
      request.open('GET', previewUrl, true);
      request.responseType = 'arraybuffer';
      request.onload = function() {

        // Crie um contexto offline
        var OfflineContext = window.OfflineAudioContext || window.webkitOfflineAudioContext;
        var offlineContext = new OfflineContext(2, 30 * 44100, 44100);

        offlineContext.decodeAudioData(request.response, function(buffer) {

          // Criar fonte de buffer
          var source = offlineContext.createBufferSource();
          source.buffer = buffer;

          // Batidas, ou chutes, geralmente ocorrem em torno da faixa de 100 a 150 Hz.
          // Abaixo disso está geralmente a linha de baixo. Então, vamos nos concentrar apenas nisso.

          // Primeiro, um passe baixo para remover a maior parte da música.

          var lowpass = offlineContext.createBiquadFilter();
          lowpass.type = "lowpass";
          lowpass.frequency.value = 150;
          lowpass.Q.value = 1;

          // Execute a saída da fonte através da passagem baixa.

          source.connect(lowpass);

          // Agora, um highpass para remover a linha de baixo.

          var highpass = offlineContext.createBiquadFilter();
          highpass.type = "highpass";
          highpass.frequency.value = 100;
          highpass.Q.value = 1;

          // Execute a saída do passa-baixo através do passa-alto.

          lowpass.connect(highpass);

          // Execute uma saída da passagem alta por meio de nosso contexto offline.

          highpass.connect(offlineContext.destination);

          // Inicie a fonte e renderize a saída no contexto offline.

          source.start(0);
          offlineContext.startRendering();
        });

        offlineContext.oncomplete = function(e) {
          var buffer = e.renderedBuffer;
          var peaks = getPeaks([buffer.getChannelData(0), buffer.getChannelData(1)]);
          var groups = getIntervals(peaks);

          var svg = document.querySelector('#svg');
          svg.innerHTML = '';
          var svgNS = 'http://www.w3.org/2000/svg';
          var rect;
          peaks.forEach(function(peak) {
            rect = document.createElementNS(svgNS, 'rect');
            rect.setAttributeNS(null, 'x', (100 * peak.position / buffer.length) + '%');
            rect.setAttributeNS(null, 'y', 0);
            rect.setAttributeNS(null, 'width', 1);
            rect.setAttributeNS(null, 'height', '100%');
            svg.appendChild(rect);
          });

          rect = document.createElementNS(svgNS, 'rect');
          rect.setAttributeNS(null, 'id', 'progress');
          rect.setAttributeNS(null, 'y', 0);
          rect.setAttributeNS(null, 'width', 1);
          rect.setAttributeNS(null, 'height', '100%');
          svg.appendChild(rect);

          svg.innerHTML = svg.innerHTML; // forçar repintura em alguns navegadores

          var top = groups.sort(function(intA, intB) {
            return intB.count - intA.count;
          }).splice(0, 5);

          text.innerHTML = '<div id="guess">Guess for track <strong>' + track.name + '</strong> by ' +
            '<strong>' + track.artists[0].name + '</strong> is <strong>' + Math.round(top[0].tempo) + ' BPM</strong>' +
            ' with ' + top[0].count + ' samples.</div>';

          text.innerHTML += '<div class="small">Other options are ' +
            top.slice(1).map(function(group) {
              return group.tempo + ' BPM (' + group.count + ')';
            }).join(', ') +
            '</div>';

          var printENBPM = function(tempo) {
            text.innerHTML += '<div class="small">The tempo according to Spotify is ' +
                  tempo + ' BPM</div>';
          };
          spotifyApi.getAudioFeaturesForTrack(track.id)
            .then(function(audioFeatures) {
              printENBPM(audioFeatures.tempo);
            });

          result.style.display = 'block';
        };
      };
      request.send();
    });
});
