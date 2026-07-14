package com.vaultstudio.app;

import android.annotation.SuppressLint;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.media.AudioManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.media.app.NotificationCompat.MediaStyle;

import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MediaPlaybackService extends Service {
    public static final String ACTION_MEDIA_CONTROL = "com.vaultstudio.app.MEDIA_CONTROL";
    public static final String ACTION_SET_METADATA = "com.vaultstudio.app.SET_METADATA";
    public static final String ACTION_SET_PLAYBACK_STATE = "com.vaultstudio.app.SET_PLAYBACK_STATE";
    public static final String ACTION_SET_POSITION_STATE = "com.vaultstudio.app.SET_POSITION_STATE";
    private static final String ACTION_PLAY = "com.vaultstudio.app.PLAY";
    private static final String ACTION_PAUSE = "com.vaultstudio.app.PAUSE";
    private static final String ACTION_PREVIOUS = "com.vaultstudio.app.PREVIOUS";
    private static final String ACTION_NEXT = "com.vaultstudio.app.NEXT";

    public static final String EXTRA_MEDIA_ACTION = "mediaAction";
    public static final String EXTRA_TITLE = "title";
    public static final String EXTRA_ARTIST = "artist";
    public static final String EXTRA_ALBUM = "album";
    public static final String EXTRA_ARTWORK_URL = "artworkUrl";
    public static final String EXTRA_PLAYBACK_STATE = "playbackState";
    public static final String EXTRA_DURATION = "duration";
    public static final String EXTRA_POSITION = "position";
    public static final String EXTRA_PLAYBACK_RATE = "playbackRate";
    public static final String EXTRA_SEEK_TIME = "seekTime";

    public static final String STATE_NONE = "none";
    public static final String STATE_PAUSED = "paused";
    public static final String STATE_PLAYING = "playing";

    private static final String CHANNEL_ID = "vault_playback";
    private static final int NOTIFICATION_ID = 2401;

    private final ExecutorService artworkExecutor = Executors.newSingleThreadExecutor();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private MediaSessionCompat mediaSession;
    private NotificationManager notificationManager;
    private String title = "Unknown Track";
    private String artist = "Unknown Artist";
    private String album = "{vault}";
    private String artworkUrl = "";
    private Bitmap artwork;
    private String playbackState = STATE_NONE;
    private long durationMs;
    private long positionMs;
    private float playbackRate = 1f;

    @Override
    public void onCreate() {
        super.onCreate();
        notificationManager = getSystemService(NotificationManager.class);
        createNotificationChannel();

        mediaSession = new MediaSessionCompat(this, "VaultMediaSession");
        mediaSession.setFlags(
            MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS |
            MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS
        );
        mediaSession.setPlaybackToLocal(AudioManager.STREAM_MUSIC);
        mediaSession.setSessionActivity(PendingIntent.getActivity(
            this,
            0,
            new Intent(this, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        ));
        mediaSession.setCallback(new MediaSessionCompat.Callback() {
            @Override public void onPlay() { sendAction("play"); }
            @Override public void onPause() { sendAction("pause"); }
            @Override public void onSkipToPrevious() { sendAction("previousTrack"); }
            @Override public void onSkipToNext() { sendAction("nextTrack"); }
            @Override public void onStop() { sendAction("stop"); }
            @Override public void onSeekTo(long pos) { sendSeekAction(pos); }
        });
        mediaSession.setActive(true);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null || intent.getAction() == null) return START_NOT_STICKY;

        switch (intent.getAction()) {
            case ACTION_SET_METADATA:
                title = intent.getStringExtra(EXTRA_TITLE);
                artist = intent.getStringExtra(EXTRA_ARTIST);
                album = intent.getStringExtra(EXTRA_ALBUM);
                String nextArtworkUrl = intent.getStringExtra(EXTRA_ARTWORK_URL);
                if (nextArtworkUrl == null) nextArtworkUrl = "";
                if (!nextArtworkUrl.equals(artworkUrl)) {
                    artworkUrl = nextArtworkUrl;
                    artwork = null;
                    loadArtwork(nextArtworkUrl);
                }
                updateMetadata();
                updateNotification(false);
                break;
            case ACTION_SET_PLAYBACK_STATE:
                playbackState = intent.getStringExtra(EXTRA_PLAYBACK_STATE);
                if (playbackState == null) playbackState = STATE_NONE;
                updatePlaybackState();
                if (STATE_NONE.equals(playbackState)) {
                    stopForeground(STOP_FOREGROUND_REMOVE);
                    notificationManager.cancel(NOTIFICATION_ID);
                    stopSelf();
                } else {
                    updateNotification(STATE_PLAYING.equals(playbackState));
                }
                break;
            case ACTION_SET_POSITION_STATE:
                long nextDurationMs = secondsToMillis(intent.getDoubleExtra(EXTRA_DURATION, 0));
                positionMs = secondsToMillis(intent.getDoubleExtra(EXTRA_POSITION, 0));
                playbackRate = (float) intent.getDoubleExtra(EXTRA_PLAYBACK_RATE, 1);
                if (durationMs != nextDurationMs) {
                    durationMs = nextDurationMs;
                    updateMetadata();
                }
                updatePlaybackState();
                break;
            case ACTION_PLAY:
                sendAction("play");
                break;
            case ACTION_PAUSE:
                sendAction("pause");
                break;
            case ACTION_PREVIOUS:
                sendAction("previousTrack");
                break;
            case ACTION_NEXT:
                sendAction("nextTrack");
                break;
            default:
                break;
        }

        return START_NOT_STICKY;
    }

    private void updateMetadata() {
        MediaMetadataCompat.Builder builder = new MediaMetadataCompat.Builder()
            .putString(MediaMetadataCompat.METADATA_KEY_TITLE, safe(title, "Unknown Track"))
            .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, safe(artist, "Unknown Artist"))
            .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, safe(album, "{vault}"))
            .putString(MediaMetadataCompat.METADATA_KEY_ALBUM_ARTIST, safe(artist, "Unknown Artist"))
            .putString(MediaMetadataCompat.METADATA_KEY_DISPLAY_TITLE, safe(title, "Unknown Track"))
            .putString(MediaMetadataCompat.METADATA_KEY_DISPLAY_SUBTITLE, safe(artist, "Unknown Artist"))
            .putString(MediaMetadataCompat.METADATA_KEY_DISPLAY_DESCRIPTION, safe(album, "{vault}"))
            .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, durationMs);
        if (artwork != null) {
            builder.putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, artwork);
            builder.putBitmap(MediaMetadataCompat.METADATA_KEY_ART, artwork);
            builder.putBitmap(MediaMetadataCompat.METADATA_KEY_DISPLAY_ICON, artwork);
        }
        mediaSession.setMetadata(builder.build());
    }

    private void updatePlaybackState() {
        int state = PlaybackStateCompat.STATE_NONE;
        if (STATE_PLAYING.equals(playbackState)) state = PlaybackStateCompat.STATE_PLAYING;
        if (STATE_PAUSED.equals(playbackState)) state = PlaybackStateCompat.STATE_PAUSED;

        long actions = PlaybackStateCompat.ACTION_PLAY |
            PlaybackStateCompat.ACTION_PAUSE |
            PlaybackStateCompat.ACTION_PLAY_PAUSE |
            PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS |
            PlaybackStateCompat.ACTION_SKIP_TO_NEXT |
            PlaybackStateCompat.ACTION_SEEK_TO |
            PlaybackStateCompat.ACTION_STOP;

        mediaSession.setPlaybackState(new PlaybackStateCompat.Builder()
            .setActions(actions)
            .setState(state, positionMs, playbackRate)
            .build());
    }

    private Notification buildNotification() {
        PendingIntent openApp = PendingIntent.getActivity(
            this,
            0,
            new Intent(this, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        PendingIntent previous = serviceAction(ACTION_PREVIOUS, 1);
        PendingIntent playPause = serviceAction(
            STATE_PLAYING.equals(playbackState) ? ACTION_PAUSE : ACTION_PLAY,
            2
        );
        PendingIntent next = serviceAction(ACTION_NEXT, 3);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(safe(title, "Unknown Track"))
            .setContentText(safe(artist, "Unknown Artist"))
            .setSubText(safe(album, "{vault}"))
            .setContentIntent(openApp)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setOngoing(STATE_PLAYING.equals(playbackState))
            .addAction(android.R.drawable.ic_media_previous, "Previous", previous)
            .addAction(
                STATE_PLAYING.equals(playbackState)
                    ? android.R.drawable.ic_media_pause
                    : android.R.drawable.ic_media_play,
                STATE_PLAYING.equals(playbackState) ? "Pause" : "Play",
                playPause
            )
            .addAction(android.R.drawable.ic_media_next, "Next", next)
            .setStyle(new MediaStyle()
                .setMediaSession(mediaSession.getSessionToken())
                .setShowActionsInCompactView(0, 1, 2));

        if (artwork != null) builder.setLargeIcon(artwork);
        return builder.build();
    }

    @SuppressLint("MissingPermission")
    private void updateNotification(boolean startAsForeground) {
        if (STATE_NONE.equals(playbackState)) return;
        Notification notification = buildNotification();
        if (startAsForeground) {
            startForeground(NOTIFICATION_ID, notification);
        } else {
            notificationManager.notify(NOTIFICATION_ID, notification);
        }
    }

    private void loadArtwork(String url) {
        if (url.isEmpty() || url.startsWith("blob:")) return;
        artworkExecutor.execute(() -> {
            Bitmap loaded = null;
            HttpURLConnection connection = null;
            try {
                connection = (HttpURLConnection) new URL(url).openConnection();
                connection.setConnectTimeout(10000);
                connection.setReadTimeout(10000);
                connection.setDoInput(true);
                try (InputStream stream = connection.getInputStream()) {
                    loaded = BitmapFactory.decodeStream(stream);
                }
            } catch (Exception ignored) {
                // Metadata remains useful even when remote artwork cannot be loaded.
            } finally {
                if (connection != null) connection.disconnect();
            }

            Bitmap result = loaded;
            mainHandler.post(() -> {
                if (!url.equals(artworkUrl) || result == null) return;
                artwork = result;
                updateMetadata();
                updateNotification(false);
            });
        });
    }

    private void sendAction(String action) {
        Intent intent = new Intent(ACTION_MEDIA_CONTROL)
            .setPackage(getPackageName())
            .putExtra(EXTRA_MEDIA_ACTION, action);
        sendBroadcast(intent);
    }

    private PendingIntent serviceAction(String action, int requestCode) {
        Intent intent = new Intent(this, MediaPlaybackService.class).setAction(action);
        return PendingIntent.getService(
            this,
            requestCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    private void sendSeekAction(long position) {
        Intent intent = new Intent(ACTION_MEDIA_CONTROL)
            .setPackage(getPackageName())
            .putExtra(EXTRA_MEDIA_ACTION, "seekTo")
            .putExtra(EXTRA_SEEK_TIME, position / 1000.0);
        sendBroadcast(intent);
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "Media playback",
            NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription("Playback controls for {vault}");
        channel.setSound(null, null);
        notificationManager.createNotificationChannel(channel);
    }

    private static long secondsToMillis(double seconds) {
        return Math.max(0, (long) (seconds * 1000));
    }

    private static String safe(String value, String fallback) {
        return value == null || value.trim().isEmpty() ? fallback : value;
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        artworkExecutor.shutdownNow();
        if (mediaSession != null) mediaSession.release();
        super.onDestroy();
    }
}
