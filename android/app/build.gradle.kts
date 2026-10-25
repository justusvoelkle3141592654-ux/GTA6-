// Android shell for the game: a full screen WebView that loads solara-bay-2.html from the app (works offline)
plugins { id("com.android.application") }

android {
    namespace = "de.solarabay.game"
    compileSdk = 35
    defaultConfig {
        applicationId = "de.solarabay.game"
        minSdk = 26
        targetSdk = 35
        versionCode = 7
        versionName = "3.3"
    }
    // a fixed key in the project (from version 3.3): every build gets the same signature, so an update installs over the
    // installed app and keeps its save games. Only meant for sideloading, not for a store (the key is not secret).
    signingConfigs {
        create("solarabay") {
            storeFile = file("solarabay.jks")
            storePassword = "solarabay"
            keyAlias = "solarabay"
            keyPassword = "solarabay"
        }
    }
    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("solarabay")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    // no release lint: it only downloads extra tools and is not needed for this WebView shell
    lint { checkReleaseBuilds = false; abortOnError = false }
    sourceSets["main"].assets.srcDir(layout.buildDirectory.dir("gameAssets"))
}

// the game itself: the single HTML file from the web build (npm run build:html)
val copyGame by tasks.registering(Copy::class) {
    from(rootProject.file("../solara-bay-2.html")) { rename { "index.html" } }
    into(layout.buildDirectory.dir("gameAssets"))
}
tasks.named("preBuild") { dependsOn(copyGame) }
