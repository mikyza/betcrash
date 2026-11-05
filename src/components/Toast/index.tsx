import * as React from "react";
import { toast } from "react-hot-toast";
import "./toast.scss";

const toaster = (
  type: string,
  msg: string,
  currency?: string,
  point?: number,
  cashoutAmount?: number
) => {
  switch (type) {
    case "success":
      toast.custom(
        (t) => (
          <div className="alert-win celebrated ng-trigger ng-trigger-messageState ng-star-inserted ng-animating">
            <div className="multiplier ">
              <div className="label ">{msg}</div>
              <div className="value ">{point}x</div>
            </div>
            <div className="win celebrated">
              <div className="label no-wrap ">
                <span>Win</span>
                <span className="currency ">, {currency}</span>
              </div>
              <div className="value ">
                <span>{cashoutAmount}</span>
              </div>
            </div>
            <button
              type="button"
              className="close"
              onClick={() => { toast.dismiss(t.id); }}
            >
              ×
            </button>
          </div>
        )
      );
      break;
    case "error":
      toast.error(msg);
      break;

    default:
      break;
  }
};

const ICONS: Record<string, string> = {
  deposit: "💰", withdrawal: "🏦", win: "🏆", security: "🔒", system: "🔔", admin: "🛎️",
};

/** Slide-in popup for a live notification pushed from the server. */
export const notificationToast = (n: { type: string; title: string; message?: string }) => {
  toast.custom(
    (t) => (
      <div className={`app-toast app-toast--${n.type} ${t.visible ? "app-toast--in" : "app-toast--out"}`} role="status">
        <span className="app-toast__icon" aria-hidden="true">{ICONS[n.type] ?? "🔔"}</span>
        <div className="app-toast__body">
          <div className="app-toast__title">{n.title}</div>
          {n.message ? <div className="app-toast__msg">{n.message}</div> : null}
        </div>
        <button type="button" className="app-toast__close" aria-label="Dismiss" onClick={() => toast.dismiss(t.id)}>×</button>
      </div>
    ),
    { duration: 6000, position: "top-right" }
  );
};

/** Live announcement sent by an admin to everyone online. */
export const announcementToast = (title: string, message: string) => {
  toast.custom(
    (t) => (
      <div className={`app-toast app-toast--announce ${t.visible ? "app-toast--in" : "app-toast--out"}`} role="alert">
        <span className="app-toast__icon" aria-hidden="true">📢</span>
        <div className="app-toast__body">
          <div className="app-toast__title">{title}</div>
          <div className="app-toast__msg">{message}</div>
        </div>
        <button type="button" className="app-toast__close" aria-label="Dismiss" onClick={() => toast.dismiss(t.id)}>×</button>
      </div>
    ),
    { duration: 10000, position: "top-center" }
  );
};

export default toaster;
