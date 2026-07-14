package com.vaultstudio.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NativeMediaSession")
public class NativeMediaSessionPlugin extends Plugin {
    private final BroadcastReceiver actionReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            String action = intent.getStringExtra(MediaPlaybackService.EXTRA_MEDIA_ACTION);
            if (action == null) return;

            JSObject event = new JSObject();
            event.put("action", action);
            if (intent.hasExtra(MediaPlaybackService.EXTRA_SEEK_TIME)) {
                event.put("seekTime", intent.getDoubleExtra(MediaPlaybackService.EXTRA_SEEK_TIME, 0));
            }
            notifyListeners("action", event);
        }
    };

    @Override
    public void load() {
        ContextCompat.registerReceiver(
            getContext(),
            actionReceiver,
            new IntentFilter(MediaPlaybackService.ACTION_MEDIA_CONTROL),
            ContextCompat.RECEIVER_NOT_EXPORTED
        );
    }

    @Override
    protected void handleOnDestroy() {
        try {
            getContext().unregisterReceiver(actionReceiver);
        } catch (IllegalArgumentException ignored) {
            // Receiver was already removed with the activity.
        }
        super.handleOnDestroy();
    }

    @PluginMethod
    public void setMetadata(PluginCall call) {
        Intent intent = serviceIntent(MediaPlaybackService.ACTION_SET_METADATA);
        intent.putExtra(MediaPlaybackService.EXTRA_TITLE, call.getString("title", "Unknown Track"));
        intent.putExtra(MediaPlaybackService.EXTRA_ARTIST, call.getString("artist", "Unknown Artist"));
        intent.putExtra(MediaPlaybackService.EXTRA_ALBUM, call.getString("album", "{ vault.studio }"));
        intent.putExtra(MediaPlaybackService.EXTRA_ARTWORK_URL, call.getString("artworkUrl", ""));
        getContext().startService(intent);
        call.resolve();
    }

    @PluginMethod
    public void setPlaybackState(PluginCall call) {
        String state = call.getString("state", MediaPlaybackService.STATE_NONE);
        Intent intent = serviceIntent(MediaPlaybackService.ACTION_SET_PLAYBACK_STATE);
        intent.putExtra(MediaPlaybackService.EXTRA_PLAYBACK_STATE, state);

        if (MediaPlaybackService.STATE_PLAYING.equals(state)) {
            ContextCompat.startForegroundService(getContext(), intent);
        } else {
            getContext().startService(intent);
        }
        call.resolve();
    }

    @PluginMethod
    public void setPositionState(PluginCall call) {
        Intent intent = serviceIntent(MediaPlaybackService.ACTION_SET_POSITION_STATE);
        intent.putExtra(MediaPlaybackService.EXTRA_DURATION, call.getDouble("duration", 0.0));
        intent.putExtra(MediaPlaybackService.EXTRA_POSITION, call.getDouble("position", 0.0));
        intent.putExtra(MediaPlaybackService.EXTRA_PLAYBACK_RATE, call.getDouble("playbackRate", 1.0));
        getContext().startService(intent);
        call.resolve();
    }

    private Intent serviceIntent(String action) {
        Intent intent = new Intent(getContext(), MediaPlaybackService.class);
        intent.setAction(action);
        return intent;
    }
}
