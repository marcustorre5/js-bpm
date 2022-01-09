var SpotifyWebApi = (function() {

  'use strict';
  var _baseUri = 'https://api.spotify.com/v1';
  var _baseTokenUri = 'https://spotify-web-api-token.herokuapp.com';
  var _accessToken = null;

  var _promiseProvider = function(promiseFunction) {
    return new window.Promise(promiseFunction);
  };

  var _checkParamsAndPerformRequest = function(requestData, options, callback) {
    var opt = {};
    var cb = null;

    if (typeof options === 'object') {
      opt = options;
      cb = callback;
    } else if (typeof options === 'function') {
      cb = options;
    }
    _extend(requestData.params, opt);
    return _performRequest(requestData, cb);
  };

  var _performRequest = function(requestData, callback) {
    var promiseFunction = function(resolve, reject) {
      var req = new XMLHttpRequest();
      var type = requestData.type || 'GET';
      if (type === 'GET') {
        req.open(type,
          _buildUrl(requestData.url, requestData.params),
          true);
      } else {
        req.open(type, _buildUrl(requestData.url));
      }
      if (_accessToken) {
        req.setRequestHeader('Authorization', 'Bearer ' + _accessToken);
      }
      req.onreadystatechange = function() {
        if (req.readyState === 4) {
          var data = null;
          try {
            data = req.responseText ? JSON.parse(req.responseText) : '';
          } catch (e) {}

          if (req.status === 200 || req.status === 201) {
            if (resolve) {
              resolve(data);
            }
            if (callback) {
              callback(null, data);
            }
          } else {
            if (reject) {
              reject(req);
            }
            if (callback) {
              callback(req, null);
            }
          }
        }
      };

      if (type === 'GET') {
        req.send(null);
      } else {
        req.send(JSON.stringify(requestData.postData));
      }
    };

    if (callback) {
      promiseFunction();
      return null;
    } else {
      return _promiseProvider(promiseFunction);
    }
  };

  var _extend = function() {
    var args = Array.prototype.slice.call(arguments);
    var target = args[0];
    var objects = args.slice(1);
    target = target || {};
    for (var i = 0; i < objects.length; i++) {
      for (var j in objects[i]) {
        target[j] = objects[i][j];
      }
    }
    return target;
  };

  var _buildUrl = function(url, parameters){
    var qs = '';
    for (var key in parameters) {
      if (parameters.hasOwnProperty(key)) {
        var value = parameters[key];
        qs += encodeURIComponent(key) + '=' + encodeURIComponent(value) + '&';
      }
    }
    if (qs.length > 0){
      qs = qs.substring(0, qs.length - 1); //corte o último '&'
      url = url + '?' + qs;
    }
    return url;
  };

  var Constr = function() {};

  Constr.prototype = {
    constructor: SpotifyWebApi
  };

  /**
   * Define o token de acesso a ser usado.
   * Ver [o Guia de Autorização](https://developer.spotify.com/web-api/authorization-guide/) no
   * site Spotify Developer para obter mais informações sobre como obter um token de acesso.
   * @param {string} accessToken O token de acesso
   * @return {void}
   */
  Constr.prototype.setAccessToken = function(accessToken) {
    _accessToken = accessToken;
  };

  /**
   * Busca faixas do catálogo do Spotify de acordo com uma consulta.
   * Ver [Procure por um item](https://developer.spotify.com/web-api/search-item/) nn
   * site Spotify Developer para obter mais informações sobre o terminal.
   * @param {Object} options AObjeto JSON com opções que podem ser passadas
   * @param {function(Object, Object)} callback Um retorno de chamada opcional que recebe 2 parâmetros. O primeiro
   * um é o objeto de erro (nulo se não houver erro) e o segundo é o valor se a solicitação for bem-sucedida.
   * @return {Object} Null se um retorno de chamada for fornecido, um objeto `Promise` caso contrário
   */
  Constr.prototype.searchTracks = function(query, options, callback) {
    var requestData = {
      url: _baseUri + '/search/',
      params: {
        q: query,
        type: 'track'
      }
    };
    return _checkParamsAndPerformRequest(requestData, options, callback);
  };

  /**
   * Obtenha recursos de áudio para uma única faixa identificada por seu ID Spotify exclusivo.
   * Ver [Obtenha recursos de áudio para uma faixa](https://developer.spotify.com/web-api/get-audio-features/) no
   * site Spotify Developer para obter mais informações sobre o terminal.
   * @param {string} trackId O id da pista. Se você conhece o URI do Spotify é fácil
   * para encontrar o id da pista (e.g. spotify:track:<here_is_the_track_id>)
   * @param {function(Object,Object)} callback Um retorno de chamada opcional que recebe 2 parâmetros. O primeiro
   * um é o objeto de erro (nulo se não houver erro) e o segundo é o valor se a solicitação for bem-sucedida.
   * @return {Object} Null se um retorno de chamada for fornecido, um objeto `Promise` caso contrário
   */
  Constr.prototype.getAudioFeaturesForTrack = function(trackId, callback) {
    var requestData = {
      url: _baseUri + '/audio-features/' + trackId
    };
    return _checkParamsAndPerformRequest(requestData, {}, callback);
  };

  /**
   * Obtém um token para ser usado na API da Web do Spotify
   */
  Constr.prototype.getToken = function(callback) {
    var requestData = {
      url: _baseTokenUri + '/token'
    };
    return _checkParamsAndPerformRequest(requestData, {}, callback);
  };

  return Constr;
})();
