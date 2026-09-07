function uniqueLines(value: string) {
	return [
		...new Set(
			value
				.trim()
				.split(/\r?\n/)
				.map((line) => line.trim())
				.filter(Boolean),
		),
	];
}

// Used only until the authenticated Too Lost catalog is available.
export const fallbackGenres = uniqueLines(String.raw`
Alternative
Alternative/Experimental
Alternative/Gothic
Alternative/Grunge
Alternative/Indie Pop
Alternative/Indie Rock
Alternative/Rock
Ambient/New Age
Ambient/New Age/Meditation
Blues
Blues/Contemporary Blues
Blues/New Orleans Blues
Blues/Traditional Blues
Children's Music
Children's Music/Classic
Children's Music/Holiday
Children's Music/Stories
Classical
Classical/Antique
Classical/Baroque
Classical/Chamber
Classical/Concert
Classical/Modern Compositions
Classical/Opera
Classical/Orchestral
Classical/Piano
Classical/Romantic
Comedy
Country
Country/Bluegrass
Country/Contemporary
Country/Honky Tonk
Country/Nashville
Country/Pop
Country/Square Dance
Dance
Easy Listening
Easy Listening/Bar Jazz/Cocktail
Easy Listening/Bossa Nova
Easy Listening/Lounge
Easy Listening/Traditional
Electronic
Electronic/Acid House
Electronic/Afro House
Electronic/Breaks
Electronic/Broken beat
Electronic/Chill Out
Electronic/DJ Tools/Sample Packs
Electronic/Dance
Electronic/Deep House
Electronic/Downtempo - experimental
Electronic/Drum & Bass
Electronic/Dub/Reggae/Dancehall
Electronic/Dubstep/Grime
Electronic/Electro House
Electronic/Glitch Hop
Electronic/Hard Dance
Electronic/Hard Techno
Electronic/Hardcore
Electronic/Hardstyle
Electronic/House
Electronic/Indie Dance/Nu Disco
Electronic/Jazz
Electronic/Minimal
Electronic/Pop Trance
Electronic/Progressive House
Electronic/Psy-Trance
Electronic/Tech House
Electronic/Techno
Electronic/Trance
Electronic/Trip Hop
Experimental
Fitness&Workout
Flamenco
Folk
Funk/R&B
Hip-Hop/Rap
Hip-Hop/Rap/Gangsta & Hardcore
Holiday/Christmas
House
Inspirational
Jazz
Jazz/Bebop
Jazz/Big Band
Jazz/Brazilian Jazz
Jazz/Classic
Jazz/Contemporary
Jazz/Dixie/Rag Time
Jazz/Free Jazz
Jazz/Fusion
Jazz/Jazz Funk
Jazz/Latin Jazz
Jazz/Nu Jazz/Acid Jazz
Jazz/Smooth Jazz
Jazz/Swing
Jazz/Traditional
Jazz/World
Karaoke
Latin
Latin/Bachata
Latin/Banda
Latin/Big Band
Latin/Bolero
Latin/Bossa Nova
Latin/Brasil/Tropical
Latin/Christian
Latin/Conjunto
Latin/Corridos
Latin/Cuban
Latin/Cumbia
Latin/Duranguense
Latin/Electronica
Latin/Grupero
Latin/Hip Hop
Latin/Latin Rap
Latin/Mambo
Latin/Mariachi
Latin/Norteño
Latin/Pop
Latin/Ranchera
Latin/Reggaeton
Latin/Regional Mexicano
Latin/Rock en Español
Latin/Salsa
Latin/Salsa/Merengue
Latin/Sierreño
Latin/Sonidero
Latin/Tango
Latin/Tejano
Latin/Tierra Caliente
Latin/Traditional Mexican
Latin/Vallenato
New Age
Pop
Pop/Contemporary/Adult
Pop/J-Pop
Pop/K-Pop
Pop/Mandopop
Pop/Singer Songwriter
Punk
R&B
Reggae
Rock
Rock/Brit-Pop
Rock/Classic
Rock/Glam Rock
Rock/Hard Rock/Heavy Metal
Rock/Heavy Metal
Rock/Progressive
Rock/Rock 'n' Roll
Rock/Singer/Songwriter
Ska
Soul
Soundtrack
Soundtrack/Anime
Soundtrack/Musical
Soundtrack/TV
Spiritual
Spiritual/Christian
Spiritual/Gospel
Spiritual/Gregorian
Spiritual/India
Spiritual/Judaica
Spiritual/World
Spoken Word/Speeches
Vocal/Nostalgia
World
World/African
World/Afro-Beat
World/Afro-Pop
World/Americas/Argentina
World/Americas/Brazilian
World/Americas/Brazilian/Axé
World/Americas/Brazilian/Black Music
World/Americas/Brazilian/Bossa Nova
World/Americas/Brazilian/Chorinho
World/Americas/Brazilian/Folk
World/Americas/Brazilian/Funk Carioca
World/Americas/Brazilian/MPB
World/Americas/Brazilian/Marchinha
World/Americas/Brazilian/Pagode
World/Americas/Brazilian/Samba
World/Americas/Brazilian/Samba-Rock
World/Americas/Brazilian/Samba-de-Raiz
World/Americas/Brazilian/Samba-enredo
World/Americas/Brazilian/Sambalanço
World/Americas/Cajun-Creole
World/Americas/Calypso
World/Americas/Colombia
World/Americas/Cuba-Caribbean
World/Americas/Mexican
World/Americas/North-American
World/Americas/Panama
World/Americas/Peru
World/Americas/South-American
World/Arabic
World/Asian/Central Asia
World/Asian/China
World/Asian/India
World/Asian/India-Bollywood
World/Asian/Japan
World/Asian/South Asia
World/Australian/Pacific
World/Ethnic
World/Europe/Eastern
World/Europe/French
World/Europe/German
World/Europe/Northern
World/Europe/Southern
World/Europe/Spain
World/Europe/Western
World/Mediterranean/Greece
World/Mediterranean/Italy
World/Mediterranean/Spain
World/Russian
World/Worldbeat
Balearic/Downtempo
Bass
Breakbeat
Disco/Nu-Disco
DJ Tools/Acappellas/Scratch Records
Drum & Bass / Jungle
Dubstep
Deep Dubstep
Dirty Dubstep/Trap/Grime
Electro
Euro Dance/Pop Dance
Footwork/Juke
Funk Soul & Jazz
Broken Beat/Nu Jazz/Nu Soul
Funk/Rare Groove
International
Hardcore/hardstyle
Gabba
Hardstyle/Jumpstyle
UK Hardcore/Nu Rave
Hip Hop/R&B
Deep House
Electro house/Electroclash
Funky/Club House
Hard House
Minimal House/Tech House
Progressive House
Scouse House/Bouncy House
Leftfield
Ambient/Drone
Coldwave/Synth
Experimental/Electronic
Industrial/Noise
Soundtracks
Reggae/Dancehall/Ska
Dancehall/Ragga/Reggaeton
Dub
Reggae Classics/Oldies/Ska
Roots Reggae/Lovers Rock/One Drop
Rock (All)
50s/60s/Rock'n'Roll/Rhythm & Blues
Indie/Alternative
Techno (All)
Hard Techno
Techno
Trance Music
Hard Trance
Pop Trance
Psychedelic Trance/Goa Trance
Uplifting Trance/Progressive Trance
UK Garage
Deep Dubstep / Grime (Grime)
Afro House (Afro / Latin, Afro Melodic, 3Step)
Amapiano (Gqom)
Ambient / Experimental
Bass / Club (UK Funky, Global Club, Jersey Club, Juke/Footwork, Reggae/Dancehall)
Bass House
Breaks / Breakbeat / UK Bass (Glitch Hop)
Brazilian Funk (Carioca Funk, Mandelao Funk, BH Funk, Melodic Funk)
Dance / Pop (Afro Pop, Pop, Tropical House)
DJ Tools (Loops, Acapellas, Battle Tools)
Downtempo
Drum & Bass (Liquid, Jump Up, Jungle, Deep, Halftime)
Dubstep (Melodic Dubstep, Midtempo)
Electro (Classic / Detroit / Modern)
Electronica
Funky House
Hard Dance / Hardcore / Neo Rave (Hardstyle, Hard House, Uptempo, Terror, UK/Happy Hardcore, Frenchcore, Neo Rave)
House (Acid, Soulful)
Indie Dance (Dark Disco)
Jackin House
Mainstage (Big Room, Electro House, Future House, Speed House, Future Rave)
Melodic House & Techno (Melodic House, Melodic Techno)
Minimal / Deep Tech (Bounce, Deep Tech)
Nu Disco / Disco (Funk / Soul, Italo)
Organic House
Psy‑Trance (Full‑On, Progressive Psy, Psychedelic, Dark & Forest, Goa Trance, Psycore & Hi‑Tech)
Tech House (Latin Tech)
Techno (Peak Time / Driving) (Driving, Peak Time)
Techno (Raw / Deep / Hypnotic) (Broken, Deep / Hypnotic, Dub, EBM, Raw)
Trance (Main Floor) (Progressive Trance, Tech Trance, Uplifting Trance, Vocal Trance, Hard Trance)
Trance (Raw / Deep / Hypnotic) (Raw Trance, Deep Trance, Hypnotic Trance)
Audiobooks
140 / Deep Dubstep / Grime
Deep Dubstep / Grime
Afro House
Amapiano
Bass / Club
Breaks / Breakbeat / UK Bass
Brazilian Funk
Dance / Electro Pop
Dance / Pop
DJ Tools
Drum & Bass
Hard Dance / Hardcore / Neo Rave
Indie Dance
Mainstage
Melodic House & Techno
Minimal / Deep Tech
Nu Disco / Disco
Organic House / Downtempo
Psy‑Trance
Tech House
Techno (Peak Time / Driving)
Techno (Raw / Deep / Hypnotic)
Trance (Main Floor)
Trance (Raw / Deep / Hypnotic)
Trap / Wave
UK Garage / Bassline
Drum & Bass / Liquid
Drum & Bass / Jump Up
Drum & Bass / Deep
Drum & Bass / Halftime
Hip-Hop
Caribbean
African
Indie Rock
Metal
Punk & Pop Punk
Country Pop
Country Dance
Eletrofunk
`);

const fallbackLanguageCodes = ["zxx","ab","aa","af","ak","sq","am","ar","an","hy","as","av","ae","ay","az","bm","ba","eu","be","bn","bh","bi","bs","br","bg","my","ca","ch","ce","ny","zh","cv","kw","co","cr","hr","cs","da","dv","nl","dz","en","eo","et","ee","fo","fj","fi","fr","ff","gl","ka","de","el","gn","gu","ht","ha","he","hz","hi","ho","hu","id","ie","ga","ig","ik","io","is","it","iu","ja","jv","kl","kn","kr","ks","kk","km","ki","rw","ky","kv","kg","ko","ku","kj","la","lb","lg","li","ln","lo","lt","lu","lv","gv","mk","mg","ms","ml","mt","mi","mr","mh","mn","na","nv","nb","nd","ne","ng","nn","no","ii","nr","oc","oj","cu","om","os","pa","pi","fa","pl","ps","pt","qu","rm","rn","ro","ru","sa","sc","sd","se","sm","sg","sr","gd","sn","si","sk","sl","so","st","es","su","sw","ss","sv","ta","te","tg","th","ti","bo","tk","tl","tn","to","tr","ts","tt","tw","ty","ug","uk","ur","uz","ve","vi","vo","wa","cy","wo","fy","xh","yi","yo","za","zu"];

const englishLanguageNames = new Intl.DisplayNames(["en"], { type: "language" });

export const fallbackLanguages = fallbackLanguageCodes.map((code) => ({
	code,
	name: code === "zxx" ? "No lyrics" : (englishLanguageNames.of(code) ?? code),
}));

export function withCurrentOption(values: string[], current?: string | null) {
	const normalized = values.filter(Boolean);
	if (current && !normalized.includes(current)) normalized.unshift(current);
	return normalized;
}
