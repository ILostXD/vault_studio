package com.vaultstudio.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeMediaSessionPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
