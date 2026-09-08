package com.badmintonboys.app;

import android.os.Bundle;
import android.view.View;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Android 15 (API 35) made edge-to-edge mandatory, and we target 36. The
        // web view therefore draws *underneath* the status bar and the gesture
        // handle — and Capacitor does not map Android's window insets onto CSS
        // env(safe-area-inset-*), so every safe-area rule in the stylesheet
        // evaluates to 0. That is why the layout sat flush against the bezel.
        //
        // Inset the content view instead. The window background is black, so the
        // reclaimed strips read as part of the app rather than as letterboxing.
        View content = findViewById(android.R.id.content);
        ViewCompat.setOnApplyWindowInsetsListener(content, (view, windowInsets) -> {
            Insets bars = windowInsets.getInsets(
                    WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            return WindowInsetsCompat.CONSUMED;
        });

        // Black bars need light icons in them.
        WindowInsetsControllerCompat controller =
                WindowCompat.getInsetsController(getWindow(), content);
        controller.setAppearanceLightStatusBars(false);
        controller.setAppearanceLightNavigationBars(false);
    }
}
