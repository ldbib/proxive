/*
 This file rewrites uri's (use url.parse to get one) to urls. Can be used in a redirect.
*/

'use strict';

function rewrite(uri, data, config) {
  var rewritten;
  if(config.domainPrefixing) {
    rewritten = 'http://';
    rewritten+= (uri.protocol === 'https:' ? 'h-t-t-p-s.' : 'h-t-t-p.');
    rewritten+= uri.hostname;
    rewritten+= (uri.port ? '.port-' + uri.port + '-port.' : '.');
    rewritten+= config.proxyServer.domain;
    rewritten+= uri.path + (uri.hash ? uri.hash : '');
  } else {
    rewritten = data.clientRequest.thisSite() + uri.href;
  }
  return rewritten;
}

module.exports = rewrite;
