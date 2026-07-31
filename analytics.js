/* Google Analytics 4 — property "ryan-heltemes.com" under the daladim account,
   filed with the other properties there rather than in a second account.
   (No project URLs named here on purpose: the project directory is canonical in
   index.html, and the coherence guard fails any file that re-derives it.)

   THE MEASUREMENT ID LIVES HERE AND NOWHERE ELSE. The site has no build step and
   no partials, so the alternative was pasting the same gtag block into five
   <head>s — five copies of one fact, which drift the first time one is edited.
   Every page loads this file instead, and the loader is injected from here. */

window.dataLayer = window.dataLayer || [];
function gtag() { dataLayer.push(arguments); }

gtag('js', new Date());
gtag('config', 'G-DB93XB8QNY');

var s = document.createElement('script');
s.async = true;
s.src = 'https://www.googletagmanager.com/gtag/js?id=G-DB93XB8QNY';
document.head.appendChild(s);
