package com.clipshelf.app;

import android.content.Intent;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * 다른 앱(유튜브 등)의 공유 메뉴로 넘어온 텍스트를 들고 있다가 웹 화면이 가져가게 한다.
 * 웹 쪽은 Capacitor.nativePromise("ShareInbox", "consume") 로 한 번 꺼내 간다.
 */
@CapacitorPlugin(name = "ShareInbox")
public class ShareInboxPlugin extends Plugin {

    private String pending;

    @Override
    public void load() {
        capture(getActivity().getIntent());
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        if (capture(intent)) {
            bridge.triggerWindowJSEvent("clipShareIncoming");
        }
    }

    private boolean capture(Intent intent) {
        if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())) return false;
        String text = intent.getStringExtra(Intent.EXTRA_TEXT);
        if (text == null || text.isEmpty()) return false;
        pending = text;
        // 화면 회전 등으로 액티비티가 다시 만들어져도 같은 공유를 두 번 열지 않게 한다.
        intent.setAction(Intent.ACTION_MAIN);
        return true;
    }

    @PluginMethod
    public void consume(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("text", pending == null ? "" : pending);
        pending = null;
        call.resolve(ret);
    }
}
