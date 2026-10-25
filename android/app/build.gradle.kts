// Android shell for the game: a full screen WebView that loads solara-bay-2.html from the app (works offline)
plugins { id("com.android.application") }

android {
    namespace = "de.solarabay.game"
    compileSdk = 35
    defaultConfig {
        applicationId = "de.solarabay.game"
        minSdk = 26
        targetSdk = 35
        versionCode = 3
        versionName = "2.2"
    }
    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("debug") // installable without a store key (sideloading)
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
