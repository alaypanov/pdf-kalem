import './style.css'

import { Text, Column, PDFDoc, Page, Container, Row, Image } from './lib'
import { StandardSize } from './lib/utils/doc-sizes';


async function generatePdf() {
  const pdfDoc = PDFDoc({
    size: StandardSize.LETTER,
    pageNumber: 'numeric',
    children: [
      Page({
        padding: 0,
        children: [
          Text('start',{
            size: 20,
          }),
          Container({
            width: 300,
            height: 100,
            bgColor: '#2F00FF',
            child: Container({
              width: 100,
              height: 50,
              bgColor: '#00ff00',
              child: Text('hello world', {})
            })
          }),
          Container({
            width: '100%',
            height: 'auto',
            bgColor: '#218D15FF',
            child: Image.png(
              '/image1.png',
            )
          }),
            Container({
              width: 160,
              height: 100,
              bgColor: '#DE1912FF',
              child: Text('hello green teste seore cdkeife sleiirk', {})
          }),
        //  FixedContainer({
        //     right: 100,
        //     top: 100,
        //     width: 100,
        //     height: 100,
        //     bgColor: '#AE12DEFF'
        //   }),

        // Row({
        //   mainAxisAlignment: 'space-between',
        //   children: [
        //     Container({
        //       width: 100,
        //       height: 100,
        //       bgColor: '#AE12DEFF',
        //       padding: 10,
        //     }),
        //     Container({
        //       width: 100,
        //       height: 100,
        //       bgColor: '#DE1912FF',
        //       child: Text('hello green', {})
        //   }),
        //   ]
        // }),
          // Column({
          //   // alignItems: 'top',
          //   children: [
          //     Text('start',{
          //       size: 20,
          //     }),
          //     Text('hello world', {}),
          //     Container({
          //       width: 200,
          //       height: 100,
          //       bgColor: '#00ff00',
          //       children: [
          //         Text('hello world', {})
          //       ]
          //     }),
          //     Container({
          //       width: 100,
          //       height: 200,
          //       bgColor: '#2F00FF',
          //       children: [
          //         Text('hello world', {})
          //       ]
          //     }),
          //     Container({
          //       width: 100,
          //       height: 50,
          //       bgColor: '#ff0000',
          //       // children: [
                  
          //       // ]
          //     }),
          //   ],
          // }),
        ],
      }),
    ],
  });

  const bytes = await pdfDoc.save();
  return bytes
}



window.addEventListener("load", async (event) => {
  const bytes = await generatePdf()
  const pdfElement = document.getElementById('pdf')
  // console.log(bytes)
  pdfElement.src = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
});

