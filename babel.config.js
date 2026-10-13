module.exports = function (api) {
  api.cache(true);

  return {
    presets: [['babel-preset-expo']],

    overrides: [
      // jest の RN モックまで react-native-css に書き換えると循環 import で壊れるため除外する。
      // Metro はファイル名なしで設定を読むことがあり、RegExp だとエラーになるので関数で判定する
      {
        exclude: (filename) => !!filename && /[\\/]@react-native[\\/]jest-preset[\\/]/.test(filename),
        presets: ['nativewind/babel'],
      },
    ],

    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],

          alias: {
            '@/assets': './assets',
            '@': './src',
            'tailwind.config': './tailwind.config.js',
          },
        },
      ],
      'react-native-worklets/plugin',
    ],
  };
};
