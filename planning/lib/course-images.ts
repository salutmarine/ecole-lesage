import heart from '@/assets/course-images/course-0.jpg'
import lily from '@/assets/course-images/course-1.jpg'
import blackFlower from '@/assets/course-images/course-2.jpg'
import iris from '@/assets/course-images/course-3.jpg'
import traditional from '@/assets/course-images/course-4.jpg'
import fuchsiaBow from '@/assets/course-images/course-5.jpg'
import blackBow from '@/assets/course-images/course-6.jpg'
import whiteBow from '@/assets/course-images/course-7.jpg'
import poppy from '@/assets/course-images/course-8.jpg'
import goldwork from '@/assets/course-images/course-9.jpg'
import cardHolder from '@/assets/course-images/course-10.jpg'
import ribbonOne from '@/assets/course-images/course-11.jpg'
import ribbonTwo from '@/assets/course-images/course-12.jpg'
import hauteCouture from '@/assets/course-images/course-22.jpg'

const images: Record<string, string> = {
    'DECOUVERTE AIGUILLE : CŒUR BAROQUE': heart.src,
    'DECOUVERTE AIGUILLE : BRIN DE MUGUET': lily.src,
    'DECOUVERTE AIGUILLE : FLEUR NOIRE': blackFlower.src,
    'DECOUVERTE AIGUILLE : IRIS': iris.src,
    'POINTS TRADITIONNELS': traditional.src,
    'DECOUVERTE CROCHET NIVEAU 1 : NŒUD FUCHSIA': fuchsiaBow.src,
    'DECOUVERTE CROCHET NIVEAU 1 : NŒUD NOIR': blackBow.src,
    'DECOUVERTE CROCHET NIVEAU 1 : NŒUD BLANC': whiteBow.src,
    'DECOUVERTE CROCHET NIVEAU 2 – COQUELICOT': poppy.src,
    'DECOUVERTE CANETILLE : BRODERIE D’OR': goldwork.src,
    'DÉCOUVERTE PASSEMENTERIE : PORTE CARTE': cardHolder.src,
    'BRODERIE AU RUBAN : NIVEAU 1': ribbonOne.src,
    'BRODERIE AU RUBAN : NIVEAU 2': ribbonTwo.src,
    'HAUTE COUTURE': hauteCouture.src,
}

export function courseImage(course: string) {
    return images[course]
}
