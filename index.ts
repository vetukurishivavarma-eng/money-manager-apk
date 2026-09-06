import { registerRootComponent } from 'expo';
import { registerWidgetTaskHandler } from 'react-native-android-widget';
import { widgetTaskHandler } from './src/widget/handler';
import './src/background';
import App from './App';

registerWidgetTaskHandler(widgetTaskHandler);
registerRootComponent(App);
