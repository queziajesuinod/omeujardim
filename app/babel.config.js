module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // ATENÇÃO, mudou no Reanimated 4: o plugin agora vem do pacote
      // react-native-worklets, não mais 'react-native-reanimated/plugin'.
      // Se você copiar um tutorial antigo, o app compila e as animações
      // simplesmente não acontecem, sem erro nenhum. Este é o item que mais
      // faz gente perder uma tarde.
      // E ele precisa ser o ÚLTIMO da lista.
      'react-native-worklets/plugin',
    ],
  };
};
