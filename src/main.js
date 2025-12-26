import { createElement, render } from './lib/mini-react.js';
import App from './App.js';

const rootElement = document.getElementById('root');

render(createElement(App, {}), rootElement);
