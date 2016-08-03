interface I18n {
  process :(element:Element, translations:{[index:string]:string}) => void;
}

declare var i18nTemplate :I18n;
