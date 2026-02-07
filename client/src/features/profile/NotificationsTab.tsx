/**
 * Notifications settings tab — currently static toggles (placeholder).
 */
export function NotificationsTab() {
  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-[#4D4D4D] mb-3">
          Email Notifications
        </label>
        <div className="space-y-3">
          {[
            { label: "Generation complete", description: "Get notified when your AI generations are ready", enabled: true },
            { label: "Weekly digest", description: "Summary of your activity and new features", enabled: false },
            { label: "Marketing updates", description: "News about FormaStudio and special offers", enabled: false },
          ].map((item, idx) => (
            <div key={idx} className="flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-200">
              <div>
                <p className="text-sm text-[#0A0A0A]">{item.label}</p>
                <p className="text-xs text-[#757575]">{item.description}</p>
              </div>
              <button
                className={`w-12 h-6 rounded-full transition-colors relative ${
                  item.enabled ? "bg-[#0A0A0A]" : "bg-gray-200"
                }`}
              >
                <div
                  className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform shadow-sm ${
                    item.enabled ? "left-7" : "left-1"
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
