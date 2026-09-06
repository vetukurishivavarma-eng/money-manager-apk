declare module 'react-native-get-sms-android' {
  interface SmsFilter {
    box?: 'inbox' | 'sent' | 'draft' | '';
    minDate?: number;
    maxDate?: number;
    maxCount?: number;
    address?: string;
    bodyRegex?: string;
  }
  const SmsAndroid: {
    list(
      filter: string,
      fail: (error: string) => void,
      success: (count: number, smsListJson: string) => void,
    ): void;
  };
  export default SmsAndroid;
}
