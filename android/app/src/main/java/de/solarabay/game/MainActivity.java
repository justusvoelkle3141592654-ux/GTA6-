package de.solarabay.game;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;

// the whole game runs in a full screen WebView (the web build, loaded from the app's assets: no internet needed)
public class MainActivity extends Activity {
    private WebView web;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);                 // save games and settings (localStorage)
        s.setMediaPlaybackRequiresUserGesture(false); // engine sounds and radio
        s.setAllowFileAccess(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportZoom(false);
        web.setBackgroundColor(0xFF0B0614);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        setContentView(web);
        if (state != null) web.restoreState(state);
        else web.loadUrl("file:///android_asset/index.html");
        hideBars();
    }

    // immersive full screen: status and navigation bar only on a swipe from the edge
    private void hideBars() {
        if (android.os.Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController c = getWindow().getInsetsController();
            if (c != null) {
                c.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
        }
    }

    @Override
    public void onWindowFocusChanged(boolean focus) {
        super.onWindowFocusChanged(focus);
        if (focus) hideBars();
    }

    // the back button goes one step back in the game (close an overlay, pause, back to the first page of the pause menu);
    // in the main menu the game does not use it and the app goes to the background like other apps
    @SuppressWarnings("deprecation")
    @Override
    public void onBackPressed() {
        web.evaluateJavascript("(function(){try{if(window.solaraBack)return window.solaraBack();" +
            "window.dispatchEvent(new KeyboardEvent('keydown',{code:'Escape',key:'Escape'}));" +
            "window.dispatchEvent(new KeyboardEvent('keyup',{code:'Escape',key:'Escape'}));return true;}catch(e){return true;}})()",
            value -> { if ("false".equals(value)) moveTaskToBack(true); });
    }

    // the game pauses and saves itself (window.solaraHide); the timers stop only after that ran,
    // because Android may end the app in the background without warning
    private boolean paused, destroyed;
    @Override
    protected void onPause() {
        super.onPause();
        paused = true;
        web.evaluateJavascript("try{window.solaraHide&&window.solaraHide()}catch(e){}", value -> {
            if (paused && !destroyed) { web.onPause(); web.pauseTimers(); }
        });
    }
    @Override
    protected void onResume() { super.onResume(); paused = false; web.onResume(); web.resumeTimers(); hideBars(); }
    @Override
    protected void onSaveInstanceState(Bundle out) { super.onSaveInstanceState(out); web.saveState(out); }
    @Override
    protected void onDestroy() { destroyed = true; web.destroy(); super.onDestroy(); }
}
