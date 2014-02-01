// Describes the interface for notification settings. Implementations will be
// browser specific.

interface INotifications {
  setIcon(iconFile : string) : void;
  setLabel(text : string) : void;
  setColor(color : string) : void;
}

