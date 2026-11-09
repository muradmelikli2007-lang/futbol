# Sixes: 6v6 futbol statistika platforması

Dostlar arasındakı 6-a-6 matçlar üçün şəxsi statistika saytı. Login yoxdur, daimi komanda yoxdur: hər matçda 12 oyunçu iki tərəfə (A və B) bölünür.

## İşə salmaq

Node.js 20 və ya daha yeni lazımdır.

```bash
npm run install:all     # bir dəfə: server və client paketlərini qurur
npm run build           # saytı yığır (client/dist)
npm start               # http://localhost:3001
```

Məlumat `server/data/football.db` faylında (SQLite) saxlanır. Brauzeri yeniləyəndə də, serveri söndürəndə də qalır. Ehtiyat nüsxə üçün bu faylı kopyalamaq kifayətdir.

Telefonda açmaq üçün eyni Wi-Fi-da `http://KOMPÜTERİN-IP-si:3001` ünvanına gir.

## İnkişaf rejimi

```bash
npm run dev             # server :3001, sayt :5173 (dəyişiklik dərhal görünür)
npm test                # backend testləri
```

## Demo məlumat (istəyə bağlı)

Saytın dolu halda necə göründüyünü görmək üçün ayrı bir demo baza var. Əsl bazana toxunmur.

```bash
npm run seed:demo --prefix server
DB_PATH=server/data/demo.db npm start
```

## Qaydalar

- Hesablama: bütün statistika matç və qol qeydlərindən hər sorğuda yenidən hesablanır. Heç bir ümumi say ayrıca saxlanmır, ona görə matçı redaktə edəndə və ya siləndə hər şey düzgün yenilənir.
- Skor qol hadisələrindən sayılır. Qol siyahısı ilə skor bir-birindən fərqlənə bilməz.
- Reytinq ortalamasına reytinqsiz matçlar daxil edilmir.
- "Best players" xalı: qol 4, assist 3, qələbə 2, bərabərlik 1, MVP 3 (matç başına orta).
- Orta reytinq, qələbə faizi və "best players" siyahılarında minimum matç sayı var (standart 3, səhifədən dəyişdirilir).
- Matçı olan oyunçunu və ya mövsümü silmək olmur. Əvvəl matçları redaktə et və ya sil.
