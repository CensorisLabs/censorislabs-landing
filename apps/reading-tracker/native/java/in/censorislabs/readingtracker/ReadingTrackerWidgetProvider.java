package in.censorislabs.readingtracker;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

public class ReadingTrackerWidgetProvider extends AppWidgetProvider {
    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        SharedPreferences data = context.getSharedPreferences("reading_widget", Context.MODE_PRIVATE);
        for (int widgetId : appWidgetIds) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.reading_tracker_widget);
            String title = data.getString("title", "Choose your next book");
            int progress = Math.max(0, Math.min(100, data.getInt("progress", 0)));
            int current = Math.max(0, data.getInt("currentPage", 0));
            int total = Math.max(0, data.getInt("totalPages", 0));
            String pages = total > 0 ? current + " / " + total + " pages  ·  " + progress + "%" : "Open Reading Tracker to choose a book";
            views.setTextViewText(R.id.widget_buddy, data.getString("buddyAvatar", "📚") + "  " + data.getString("buddyName", "Page"));
            views.setTextViewText(R.id.widget_title, title);
            views.setTextViewText(R.id.widget_pages, pages);
            views.setTextViewText(R.id.widget_streak, "🔥 " + data.getInt("streak", 0) + " day streak");
            views.setProgressBar(R.id.widget_progress, 100, progress, false);

            Intent launch = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
            if (launch != null) {
                PendingIntent pending = PendingIntent.getActivity(context, 1, launch, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
                views.setOnClickPendingIntent(R.id.widget_root, pending);
            }
            manager.updateAppWidget(widgetId, views);
        }
    }
}
