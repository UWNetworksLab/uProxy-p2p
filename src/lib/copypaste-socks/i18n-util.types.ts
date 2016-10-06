interface I18nUtil {
  translateStrings(node:Element) : void;
  changeLanguage(language:string) : void;
  getBrowserLanguage() : string;
}
export default I18nUtil;
