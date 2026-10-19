import { DarkTheme, DefaultTheme, type Theme } from 'expo-router';

// ヘッダー・タブバー（react-navigation）の配色。
// react-navigation は global.css の CSS 変数を読めないため、同じ値をここにも書いている。
// global.css の色を変えたらここも揃えること（primary・background・card・foreground・border・destructive に対応）
export const LIGHT_NAVIGATION_THEME: Theme = {
  ...DefaultTheme,
  colors: {
    primary: 'rgb(190, 70, 160)',
    background: 'rgb(246, 239, 245)',
    card: 'rgb(255, 255, 255)',
    text: 'rgb(10, 10, 10)',
    border: 'rgb(227, 219, 226)',
    notification: 'rgb(231, 0, 11)',
  },
};

export const DARK_NAVIGATION_THEME: Theme = {
  ...DarkTheme,
  colors: {
    primary: 'rgb(232, 150, 220)',
    background: 'rgb(23, 17, 23)',
    card: 'rgb(42, 34, 41)',
    text: 'rgb(250, 250, 250)',
    border: 'rgb(77, 65, 76)',
    notification: 'rgb(255, 100, 103)',
  },
};
